        function wrapLabels(label, maxWidth) {
            const words = label.split(' ');
            let lines = [];
            let currentLine = '';
            for (const word of words) {
                if ((currentLine + word).length > maxWidth) {
                    lines.push(currentLine.trim());
                    currentLine = '';
                }
                currentLine += word + ' ';
            }
            lines.push(currentLine.trim());
            return lines.filter(line => line.length > 0);
        }

        const tooltipTitleCallback = (tooltipItems) => {
            const item = tooltipItems[0];
            let label = item.chart.data.labels[item.dataIndex];
            if (Array.isArray(label)) {
                return label.join(' ');
            }
            return label;
        };

        const defaultChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        title: tooltipTitleCallback
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#242325'
                    },
                    grid: {
                        color: '#e5e7eb'
                    }
                },
                x: {
                    ticks: {
                        color: '#242325'
                    },
                    grid: {
                        display: false
                    }
                }
            }
        };

        const chartColors = ['#00A6ED', '#7FB800', '#FFB400', '#F6511D'];

        new Chart(document.getElementById('generationChart'), {
            type: 'bar',
            data: {
                labels: ['代', '朝', '忠', '家', '国'],
                datasets: [{
                    label: '记录人数',
                    data: [10, 12, 15, 8, 2],
                    backgroundColor: chartColors,
                    borderColor: chartColors,
                    borderWidth: 1
                }]
            },
            options: { ...defaultChartOptions }
        });

        new Chart(document.getElementById('locationChart'), {
            type: 'doughnut',
            data: {
                labels: ['田沟', '杨家沟', '底水坝', '水井窝', '其他'],
                datasets: [{
                    label: '聚居地',
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: [
                        '#00A6ED',
                        '#7FB800',
                        '#FFB400',
                        '#F6511D',
                        '#cccccc'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            title: tooltipTitleCallback
                        }
                    }
                }
            }
        });

        new Chart(document.getElementById('nameChart'), {
            type: 'bar',
            data: {
                labels: ['代字辈', '朝字辈', '忠字辈', '家字辈'],
                datasets: [{
                    label: '名为“强”的人数',
                    data: [2, 1, 5, 2],
                    backgroundColor: chartColors.slice(0, 4),
                    borderColor: chartColors.slice(0, 4),
                    borderWidth: 1
                }]
            },
            options: { ...defaultChartOptions }
        });

        // Tongyi Qianwen API Integration for Chatbot
        const chatHistoryDisplay = document.getElementById('chatHistoryDisplay');
        const chatInput = document.getElementById('chatInput');
        const sendChatBtn = document.getElementById('sendChatBtn');

        let chatHistory = [];
        let currentAiMessageElement = null;
        let currentAiMessageContent = '';
     
		function addMessageToChat(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender);
        
        if (sender === 'ai') {
            const contentElement = document.createElement('div');
            contentElement.className = 'markdown-content';
            contentElement.innerHTML = marked.parse(message);
            messageElement.appendChild(contentElement);
        } else {
            messageElement.textContent = message;
        }
        
        chatHistoryDisplay.appendChild(messageElement);
        chatHistoryDisplay.scrollTop = chatHistoryDisplay.scrollHeight;
        return messageElement;
    }

   function appendToAiMessage(content) {
        if (currentAiMessageElement) {
            currentAiMessageContent += content;
            const contentElement = currentAiMessageElement.querySelector('.markdown-content');
            if (contentElement) {
                contentElement.innerHTML = marked.parse(currentAiMessageContent);
                chatHistoryDisplay.scrollTop = chatHistoryDisplay.scrollHeight;
            }
        }
    }

        function getCurrentChineseDateTime() {
            const now = new Date(); // 获取当前的日期和时间对象
            
            // 定义日期格式选项，使其符合中文常用格式
            const dateOptions = {
                year: 'numeric',    // 年份，例如：2024
                month: 'long',      // 月份全称，例如：七月
                day: 'numeric'      // 日，例如：23
            };
            
            // 定义时间格式选项，使其符合中文常用格式
            const timeOptions = {
                hour: '2-digit',    // 小时，两位数，例如：08
                minute: '2-digit', // 分钟，两位数，例如：00
                second: '2-digit', // 秒，两位数，例如：00
                hour12: false       // 使用24小时制
            };
            
            // 将日期和时间分别格式化为中文常用字符串
            // 'zh-CN' 表示中国大陆的语言环境
            const formattedDate = now.toLocaleDateString('zh-CN', dateOptions);
            const formattedTime = now.toLocaleTimeString('zh-CN', timeOptions);
            return `${formattedDate} ${formattedTime}`;
        }

        async function streamQwenResponse(messages) {
            const apiKey = "sk-aa0690323b29465c8ee7e2b0297899e6"; // 替换为你的API密钥
            const apiUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
            
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'X-DashScope-SSE': 'enable' // 启用服务器发送事件(SSE)
                    },
                    body: JSON.stringify({
                        //model: "qwen-turbo",
						model: "qwen-plus",
                        messages: messages,
                        stream: true
                    })
                });

                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    
                    // 处理可能的多条消息
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // 最后一行可能不完整，保留在buffer中

                    for (const line of lines) {
                        if (line.startsWith('data:') && line !== 'data: [DONE]') {
                            try {
                                const data = JSON.parse(line.substring(5));
                                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                    appendToAiMessage(data.choices[0].delta.content);
                                }
                            } catch (e) {
                                console.error('解析SSE数据错误:', e);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('流式请求错误:', error);
                appendToAiMessage('\n\n[发生错误，请重试]');
            }
        }
		
		function base64DecodeUnicode(str) {
			// 使用 TextDecoder 来处理 UTF-8
			const bytes = Uint8Array.from(atob(str), c => c.charCodeAt(0));
			return new TextDecoder('utf-8').decode(bytes);
		}
		
		let familyData = ""
		fetch('/jiapu/familyData.encoded.txt')
			.then(response => response.text())
			.then(content => { 
				const baseDecoded = base64DecodeUnicode(content)
				familyData = baseDecoded.split("").reverse().join("")
				//console.log(`familyData:${familyData}`)
				});	

        sendChatBtn.addEventListener('click', async () => {		
            const userQuery = chatInput.value.trim();
            if (!userQuery) return;

            // 添加用户消息
            addMessageToChat(userQuery, 'user');
            chatInput.value = '';
            chatHistory.push({ role: "user", content: userQuery });

            // 创建AI消息元素并初始化
            currentAiMessageElement = addMessageToChat('思考中...', 'ai');
            currentAiMessageContent = '';

            sendChatBtn.disabled = true;
            const originalButtonContent = sendChatBtn.innerHTML;
            sendChatBtn.innerHTML = `思考中<span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>`;

            try {
				const systemInstruction = `
					现在时间是:${getCurrentChineseDateTime()}. 
					你是一个家族谱系专家，
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
					下面是提供给你索引信息的杨氏族谱书的内容:

				`;				
			
				// 构造消息数组
				const messages = [
					{ role: "system", content: systemInstruction + "\n\n" + familyData },
					...chatHistory.map(msg => ({ role: msg.role, content: msg.content }))
				];
									
				// 开始流式请求
				await streamQwenResponse(messages);

				// 将完整的AI响应添加到聊天历史
				chatHistory.push({ role: "assistant", content: currentAiMessageContent });
				
            } catch (error) {
                console.error('处理请求时出错:', error);
                appendToAiMessage('\n\n[发生错误，请重试]');
            } finally {
                sendChatBtn.disabled = false;
                sendChatBtn.innerHTML = originalButtonContent;
                currentAiMessageElement = null;
                currentAiMessageContent = '';
            }
        });

        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !sendChatBtn.disabled) {
                sendChatBtn.click();
            }
        });