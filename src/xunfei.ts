import DBUtils from "./data.js";
import {config} from "./config.js";
import {ChatCompletionRequestMessage} from "openai";
import WebSocket from "ws";
import crypto from 'crypto';
import { URLSearchParams } from 'url';

enum REQUEST_TYPE {
    // 聊天
    Chat,
    // 图片生成
    ImageGeneration,
    // 图片理解
    ImageUnderstanding
}

const configuration = {
    appId: config.xunfei_app_id,
    apiKey: config.xunfei_api_key,
    apiSecret: config.xunfei_api_secret,
};
const chatHostUrl = "https://spark-api.xf-yun.com/v3.1/chat";
const imageGenerationHostUrl = "https://spark-api.xf-yun.com/v3.1/chat";
const imageUnderstandingHostUrl = "https://spark-api.xf-yun.com/v3.1/chat";
let answer: string

export interface AnswerCallBack {
    onAnswer(answer: string): any
}

/**
 * 获取不通模式下的host url地址
 * @param type
 */
function getHostUrl(type: REQUEST_TYPE) {
    switch (type) {
        case REQUEST_TYPE.ImageGeneration:
            return imageGenerationHostUrl
        case REQUEST_TYPE.ImageUnderstanding:
            return imageUnderstandingHostUrl
        case REQUEST_TYPE.Chat:
        default:
            return chatHostUrl
    }
}

/**
 * 获取鉴权url
 */
async function getAuthorizationUrl(type: REQUEST_TYPE) {
    const url = new URL(getHostUrl(type));
    const date = new Date().toUTCString();

    const builder = `host: ${url.host}\n` +
        `date: ${date}\n` +
        `GET ${url.pathname} HTTP/1.1`;
    console.log("builder is ", builder)

    const hmac = crypto.createHmac('sha256', configuration.apiSecret);
    hmac.update(builder);
    const tmpSha = hmac.digest();

    const signature = Buffer.from(tmpSha).toString('base64');
    console.log("signature is ", signature)

    const authorizationOrigin = `api_key="${configuration.apiKey}",algorithm="hmac-sha256",headers="host date request-line",signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin, 'utf-8').toString('base64');
    console.log("authorization is ", authorization)
    console.log("authorizationOrigin is ", authorizationOrigin)

    const searchParams = new URLSearchParams({
        authorization,
        date,
        host: url.host
    });

    const httpUrl = `https://${url.host}${url.pathname}?${searchParams.toString()}`.replace(/\+/g, '%20');
    console.log("httpUrl is ", httpUrl)
    return httpUrl;
}

/**
 * chat 对话
 * @param username
 * @param message
 */
export async function xunFei(username: string, message: string): Promise<XunFeiResponseData> {
    const authUrl = await getAuthorizationUrl(REQUEST_TYPE.Chat)
    answer = ""
    return new Promise((resolve, reject)=> {
        // 先将用户输入的消息添加到数据库中
        const user = DBUtils.getUserByUsername(username);
        DBUtils.addUserMessage(username, message);
        const messages = DBUtils.getChatMessage(username);

        const url = authUrl.replace("https://", "wss://").replace("http://", "ws://");
        console.log("请求地址:", url)
        const webSocket: WebSocket = new WebSocket(url);

        webSocket.on("open", () => {
            console.log('WebSocket连接已打开');
            const requestData: RequestData = {
                header: {
                    app_id: config.xunfei_app_id,
                    uid: user.userId
                },
                parameter: {
                    chat: {
                        domain: "generalv3",
                        temperature: config.temperature,
                        max_tokens: 4096,
                        chat_id: user.userId
                    }
                },
                payload: {
                    message: {
                        text: messages
                    }
                }
            }
            console.log("请求数据：" + JSON.stringify(requestData))
            webSocket.send(JSON.stringify(requestData))
        })

        webSocket.on("message", (event: WebSocket.Data) => {
            console.log(`接收到WebSocket消息: ${event}`);
            let str = ""
            if (typeof event === "object" && event instanceof Buffer) {
                // 处理 Buffer 类型的数据
                str = event.toString()
            } else {
                // 处理其他类型的数据
                console.log(`Received data: ${event}`);
            }
            const responseData: ResponseData = JSON.parse(str);
            if (responseData.header.code === 0) {
                if (responseData.header.status !== 2) {
                    const pl: Payload = responseData.payload;
                    const temp: Array<ChatCompletionRequestMessage> = pl.choices.text;
                    answer += temp[0].content;
                } else {
                    const pl1: Payload = responseData.payload;
                    const textUsage: TextUsage = pl1.usage.text;
                    const totalToken: number = textUsage.total_tokens;
                    const temp1: Array<ChatCompletionRequestMessage> = pl1.choices.text;
                    answer += temp1[0].content;
                    console.log("返回结果为：\n" + answer);
                    resolve({
                        answer: answer,
                        isOverTokenLimit: totalToken > 3072
                    });
                    webSocket.close();
                }
            } else {
                console.log("返回结果错误：\n" + responseData.header.code + responseData.header.message);
            }
        });

        webSocket.on("close", (code, reason) => {
            console.log('WebSocket连接已关闭', code, reason);
            reject()
        });

        webSocket.on("error", (err) => {
            console.log('WebSocket连接出错', err);
            reject()
        });
    })
}

export interface XunFeiResponseData {
    answer: string;
    isOverTokenLimit: boolean;
}

interface ResponseData {
    header: Header
    payload: Payload
}

interface Header {
    code: number;
    message: string;
    sid: string;
    status: number;
}

interface Payload {
    choices: Choices
    usage: Usage
}

interface Choices {
    status: number;
    seq: number;
    text: Array<ChatCompletionRequestMessage>;
}

interface Usage {
    text: TextUsage;
}

interface TextUsage {
    question_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

interface RequestData {
    header: RequestHeader;
    parameter: RequestParameter;
    payload: RequestPayload
}

interface RequestHeader {
    app_id: string;
    uid: string;
}

interface RequestParameter {
    chat: RequestParameterChat;
}

interface RequestParameterChat {
    domain: string;
    temperature?: number;
    max_tokens?: number;
    top_k?: number;
    chat_id?: string;
}

interface RequestPayload {
    message: RequestPayloadMessage;
}

interface RequestPayloadMessage {
    text: Array<ChatCompletionRequestMessage>;
}
