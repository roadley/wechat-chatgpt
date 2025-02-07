import * as dotenv from "dotenv";
import {IConfig, platform} from "./interface.js";

dotenv.config();

export const config: IConfig = {
    api: process.env.API,
    openai_api_key: process.env.OPENAI_API_KEY || "123456789",
    xunfei_app_id: process.env.XUNFEI_APP_ID || "123456789",
    xunfei_api_key: process.env.XUNFEI_API_KEY || "123456789",
    xunfei_api_secret: process.env.XUNFEI_API_SECRET || "123456789",
    model: process.env.MODEL || "gpt-3.5-turbo",
    chatPrivateTriggerKeyword: process.env.CHAT_PRIVATE_TRIGGER_KEYWORD || "",
    chatTriggerRule: process.env.CHAT_TRIGGER_RULE || "",
    disableGroupMessage: process.env.DISABLE_GROUP_MESSAGE === "true",
    temperature: process.env.TEMPERATURE ? parseFloat(process.env.TEMPERATURE) : 0.6,
    blockWords: process.env.BLOCK_WORDS?.split(",") || [],
    chatgptBlockWords: process.env.CHATGPT_BLOCK_WORDS?.split(",") || [],
};
