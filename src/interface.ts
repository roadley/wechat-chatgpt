import {ChatCompletionRequestMessage} from "openai";

export interface IConfig {
    api?: string;
    openai_api_key: string;
    xunfei_app_id: string;
    xunfei_api_key: string;
    xunfei_api_secret: string;
    model: string;
    chatTriggerRule: string;
    disableGroupMessage: boolean;
    temperature: number;
    blockWords: string[];
    chatgptBlockWords: string[];
    chatPrivateTriggerKeyword: string;
}

export enum platform {
    CHATGPT = "chatgpt",
    XUNFEI = "xunfei"
}

export interface User {
    username: string,
    chatMessage: Array<ChatCompletionRequestMessage>,
    userId: string,
    platform: platform | string;
}
