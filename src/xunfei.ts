import {
    Configuration,
    CreateImageRequestResponseFormatEnum,
    CreateImageRequestSizeEnum,
    OpenAIApi
} from "openai";
import fs from "fs";
import DBUtils from "./data.js";
import {config} from "./config.js";

const configuration = {
    appId: config.xunfei_app_id,
    apiKey: config.xunfei_api_key,
    apiSecret: config.xunfei_api_secret,
};
const hostUrl = "https://spark-api.xf-yun.com/v1.1/chat";
let webSocket: WebSocket
let answer: string

/**
 * 获取鉴权url
 * @param hostUrl
 * @param apiKey
 * @param apiSecret
 */
async function getAuthorizationUrl() {
    const url = new URL(hostUrl);
    const date = new Date().toUTCString();

    const builder = `host: ${url.host}\n` +
        `date: ${date}\n` +
        `GET ${url.pathname} HTTP/1.1`;

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', configuration.apiSecret);
    hmac.update(builder);
    const signature = hmac.digest('base64');

    const authorizationOrigin = `api_key="${configuration.apiKey}",algorithm="hmac-sha256",headers="host date request-line",signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin, 'utf-8').toString('base64');

    const queryParams: {
        [key: string]: string;
    } = {
        authorization,
        date,
        host: url.host
    };

    const queryStr = Object.keys(queryParams)
        .map(key => {
            `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`
        })
        .join('&');

    const httpUrl = `https://${url.host}${url.pathname}?${queryStr}`;

    return httpUrl;
}

export async function connectXunfei() {
    const authUrl = await getAuthorizationUrl()
    const url = authUrl.replace("https://", "wss://").replace("http://", "ws://");
    webSocket = new WebSocket(url);

    webSocket.addEventListener('open', function (event) {
        console.log('WebSocket连接已打开');
    });

    webSocket.addEventListener('message', function (event) {
        console.log('接收到WebSocket消息:', event.data);
        const responseData: ResponseData = JSON.parse(event.data);
        if (responseData.getHeader().getCode() === 0) {
            console.log("###########");
            if (responseData.getHeader().getStatus() !== 2) {
                console.log("****************");
                const pl: Payload = responseData.getPayload();
                const temp: ChoicesText[] = pl.getChoices().getText();
                answer += temp[0].getContent();
            } else {
                const pl1: Payload = responseData.getPayload();
                const textUsage: TextUsage = pl1.getUsage().getText();
                const prompt_tokens: number = textUsage.getPromptTokens();
                const temp1: ChoicesText[] = pl1.getChoices().getText();
                answer += temp1[0].getContent();
                console.log("返回结果为：\n" + answer);
            }
        } else {
            console.log("返回结果错误：\n" + responseData.getHeader().getCode() + responseData.getHeader().getMessage());
        }
    });

    webSocket.addEventListener('close', function (event) {
        console.log('WebSocket连接已关闭');
    });

    webSocket.addEventListener('error', function (event) {
        console.log('WebSocket连接出错');
    });
}

/**
 * Get completion from OpenAI
 * @param username
 * @param message
 */
async function xunfei(username: string, message: string): Promise<string> {
    // 先将用户输入的消息添加到数据库中
    DBUtils.addUserMessage(username, message);
    const messages = DBUtils.getChatMessage(username);
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: config.temperature,
    });
    let assistantMessage = "";
    try {
        if (response.status === 200) {
            assistantMessage = response.data.choices[0].message?.content.replace(/^\n+|\n+$/g, "") as string;
        } else {
            console.log(`Something went wrong,Code: ${response.status}, ${response.statusText}`)
        }
    } catch (e: any) {
        if (e.request) {
            console.log("请求出错");
        }
    }
    return assistantMessage;
}

class ResponseData {
    private header!: Header
    private payload!: Payload

    getHeader() {
        return this.header;
    }

    getPayload() {
        return this.payload;
    }
}

class Header {
    private code!: number;
    private message!: string;
    private sid!: string;
    private status!: number;

    getCode(): number {
        return this.code;
    }

    getMessage(): string {
        return this.message;
    }

    getSid(): string {
        return this.sid;
    }

    getStatus(): number {
        return this.status;
    }
}

class Payload {
    private choices!: Choices
    private usage!: Usage

    getChoices() {
        return this.choices;
    }

    getUsage() {
        return this.usage;
    }
}

class Choices {
    private status!: number;
    private seq!: number;
    private text!: ChoicesText[];

    getStatus() {
        return this.status;
    }

    getSeq() {
        return this.seq;
    }

    getText() {
        return this.text;
    }
}

class ChoicesText {

    private content!:string;
    private role!:string;
    private index!:number;

    getContent(): string {
        return this.content;
    }

    getRole(): string {
        return this.role;
    }

    getIndex(): number {
        return this.index;
    }
}

class Usage {
    private text!: TextUsage;

    getText(): TextUsage {
        return this.text;
    }
}

class TextUsage {
    private question_tokens!: number;
    private prompt_tokens!: number;
    private completion_tokens!: number;
    private total_tokens!: number;

    getQuestionTokens(): number {
        return this.question_tokens;
    }

    getPromptTokens(): number {
        return this.prompt_tokens;
    }

    getCompletionTokens(): number {
        return this.completion_tokens;
    }

    getTotalTokens(): number {
        return this.total_tokens;
    }
}

export {chatgpt, dalle, whisper};
