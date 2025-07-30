# -*- encoding: utf-8 -*-
import base64
import sys

# 输入输出文件
input_file = sys.argv[1]
output_file = sys.argv[2]

# 1. 读取原始文件
with open(input_file, "r", encoding="utf-8") as f:
    original_data = f.read()

# 2. 反转内容
reversed_data = original_data[::-1]  # Python 切片反转字符串

# 3. Base64 编码
encoded_data = base64.b64encode(reversed_data.encode("utf-8")).decode("utf-8")

# 4. 保存结果
with open(output_file, "w", encoding="utf-8") as f:
    f.write(encoded_data)

print(f"文件已编码保存至: {output_file}")
