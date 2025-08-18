# app.py
from flask import Flask, request, jsonify, Response
import base64
import sys
from datetime import datetime
import os
import requests
from dotenv import load_dotenv  # 用于引入环境变量    


# 初始化 Flask 应用
app = Flask(__name__)

#加载 .env文件中的环境变量   
load_dotenv()   
ali_bailian_llm_apikey = os.getenv("ALI_BAILIAN_LLM_API_KEY")
gemini_apikey = os.getenv("GEMINI_APIKEY")

LLM_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
FAMILY_DATA_FILE = './familyData.txt'


# 反转内容顺序
# reversed_data = original_data[::-1]  # Python 切片反转字符串
# Base64 编码
# encoded_data = base64.b64encode(reversed_data.encode("utf-8")).decode("utf-8")

@app.route("/ali_bailian_llm_apikey")
def send_ali_bailian_llm_apikey():
    return base64.b64encode( ali_bailian_llm_apikey[::-1].encode("utf-8")).decode("utf-8")

@app.route("/gemini_apikey")
def send_gemini_apikey():
    return base64.b64encode(gemini_apikey[::-1].encode("utf-8")).decode("utf-8")

# --- 全局变量 ---
# 在应用启动时，一次性读取家谱数据到内存，避免每次请求都读文件
try:
    with open(FAMILY_DATA_FILE, 'r', encoding='utf-8') as f:
        family_data_content = f.read()
except FileNotFoundError:
    family_data_content = "错误：未找到 familyData.txt.txt 文件。"
except Exception as e:
    family_data_content = f"错误：读取 familyData.txt.txt 文件时出错: {e}"
    
# 定义一个API端点/路由，用于处理聊天请求
@app.route('/jiapu/chat-wsk', methods=['POST'])
def chat_handler():
    """
    处理前端发送过来的聊天请求
    """
        
    # 1. 从请求中获取JSON数据
    data = request.get_json()
    print("接收到的数据:", data)

    # 2. 构建发送给LLM的完整数据
    # 系统指令
    now = datetime.now()
    formatted_time = now.strftime("%Y年%m月%d日  %H点%M分%S秒")
    system_instruction = ( 
        f"""你是一个家族谱系专家，现在时间是:{formatted_time},
        你的任务是根据提供的家族信息，回答用户关于家族成员的提问。
        你的任务是根据提供的家族信息，
		回答用户关于家族成员的提问。
		请只回答基于你所提供的信息，
		不要编造。
		如果信息不在你提供的内容中，
		请说明你无法找到相关信息。
		请以简洁、直接的中文回答。
		然后以适当语气或者给予一定的评论,
		比如查到某人是个大学学习,
		要适当赞扬几句有才聪明爱学习之类的话语,
		又或者对于活得久的你就说他养生有方得了个长寿,
		早早就过世的就给予一定的惋惜,
		并提醒大家要注意身体健康,等等之类的评论。
		
		请使用Markdown格式回复，包含标题、列表和强调文本。
		
		下面是提供给你检索信息的杨氏族谱书的内容:"""
    )

    # 组合系统指令和家谱数据
    full_system_prompt = system_instruction + \
                         "\n\n----------下面是提供给你的家谱资料---------\n" \
                         + family_data_content
    
    # 构造发送给大模型的 messages 列表
    messages = [
        {"role": "system", "content": full_system_prompt},
         *(data['messages'] if data['messages'] else [{"role": "user", "content": "请开始你的对话吧！"}])
    ]
   
    # 3. 调用LLM API    
    headers= { 
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {ali_bailian_llm_apikey}'
       # 'X-DashScope-SSE': 'enable' # 启用服务器发送事件(SSE),可自行添加
       # 'X-DashScope-SSE-Mode': 'text' # 启用文本模式，可自行添加
       # 'X-DashScope-SSE-Mode': 'json' # 启用JSON模式，可自行添加
       # 'X-DashScope-SSE-Mode': 'stream' # 启用流式模式，可自行添加
       # 'X-DashScope-SSE-Mode': 'chunk' # 启用分块模式，
    }
    payload = {
         "model": "qwen-turbo",
         "messages": messages,
         "stream": True
        }
    
    try:
        #print(f"向LLM发请求: {payload}\n")  
        response = requests.post(LLM_API_URL, headers=headers, json=payload, timeout=200, stream=True)
        response.raise_for_status()  # 如果请求失败(如4xx, 5xx状态码)，则抛出异常
        
        # 检查是否需要流式传输
        if data.get('stream', False):
            def generate():
                # 流式传输响应
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        # 只打印数据行
                        if decoded_line.startswith('data:'):
                            # 解析JSON数据并提取content
                            try:
                                import json
                                json_part = decoded_line[5:].strip()  # 移除"data: "前缀
                                if json_part != '[DONE]':
                                    data_obj = json.loads(json_part)
                                    content = data_obj.get('choices', [{}])[0].get('delta', {}).get('content', '')
                                    if content:
                                        print(f"{content}",end="", flush=True)  
                                        yield f"data: {json_part}\n"
                            except json.JSONDecodeError:
                                # 如果不是JSON格式，直接打印整行
                                print(decoded_line)
                        elif decoded_line.startswith(':'):  # 心跳消息
                            yield f"{decoded_line}\n"
            return Response(generate(), mimetype='text/event-stream')
        else:
            # 非流式传输，等待完整响应
            # 检查响应内容是否为空
            if not response.text:
                return jsonify({'error': 'LLM API 返回空响应'}), 500
                
            # 尝试解析JSON
            try:
                llm_result = response.json()
            except ValueError as ve:
                print(f"LLM API 响应不是有效的JSON格式: {response.text}", file=sys.stderr)
                return jsonify({'error': f'LLM API 响应格式错误: {str(ve)}'}), 500
            
            # 提取AI的回复
            if llm_result.get("choices") and llm_result["choices"][0].get("message"):
                ai_response = llm_result["choices"][0]["message"].get("content", "未能生成有效回复。")
                print(f"收到LLM回复,{ai_response}\n")
            else:
                ai_response = "从API返回的数据格式不正确，无法提取回复。"

            # 4. 将结果返回给前端
            return jsonify({'reply': ai_response})
    except requests.exceptions.Timeout:
        return jsonify({'reply':"LLM API 请求超时"}), 500

    except requests.exceptions.RequestException as e:
        # 打印详细错误信息到标准错误输出，便于查看
        print(f"LLM API 请求失败: {e}", file=sys.stderr)
         # 如果是 HTTP 错误（如 4xx/5xx），可以尝试打印响应内容
        if hasattr(e, 'response') and e.response is not None:
            print(f"LLM API 响应状态码: {e.response.status_code}", file=sys.stderr)
            print(f"LLM API 响应内容: {e.response.text}", file=sys.stderr)
        return jsonify({'error': f'LLM API 请求失败: {e}'}), 500
    except Exception as e: 
         # 捕获其他未知错误
         print(f"服务器内部错误: {e}", file=sys.stderr)
         return jsonify({'error': f'服务器内部错误: {e}'}), 500
    finally:
        # 确保函数总是返回一个值
        pass


# 运行Flask应用
if __name__ == '__main__':
    # 监听所有网络接口的8000端口
    app.run(host='0.0.0.0', port=8000, debug=True)
    print("__name__ = ", __name__)
    
