import {ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum} from "openai";
import {platform, User} from "./interface.js";
import {isTokenOverLimit} from "./utils.js";
import {XunFeiResponseData} from "./xunfei.js";
import shortUUID from 'short-uuid';

/**
 * 使用内存作为数据库
 */

class DB {
    private static data: User[] = [];

    /**
     * 添加一个用户, 如果用户已存在则返回已存在的用户
     * @param username
     */
    public addUser(username: string): User {
        let existUser = DB.data.find((user) => user.username === username);
        if (existUser) {
            console.log(`用户${username}已存在`);
            return existUser;
        }
        const newUser: User = {
            platform: platform.CHATGPT,
            userId: shortUUID.generate(),
            username: username,
            chatMessage: [
                {
                    role: ChatCompletionRequestMessageRoleEnum.System,
                    content: "You are a helpful assistant."
                }
            ],
        };
        DB.data.push(newUser);
        return newUser;
    }

    /**
     * 根据用户名获取用户, 如果用户不存在则添加用户
     * @param username
     */
    public getUserByUsername(username: string): User {
        return DB.data.find((user) => user.username === username) || this.addUser(username);
    }

    /**
     * 获取用户的聊天记录
     * @param username
     */
    public getChatMessage(username: string): Array<ChatCompletionRequestMessage> {
        return this.getUserByUsername(username).chatMessage;
    }

    /**
     * 设置用户的prompt
     * @param username
     * @param prompt
     */
    public setPrompt(username: string, prompt: string): void {
        const user = this.getUserByUsername(username);
        if (user.platform === platform.XUNFEI) {
            return
        }
        if (user) {
            user.chatMessage.find(
                (msg) => msg.role === ChatCompletionRequestMessageRoleEnum.System
            )!.content = prompt;
        }
    }

    /**
     * 添加用户输入的消息
     * @param username
     * @param message
     */
    public addUserMessage(username: string, message: string): void {
        const user = this.getUserByUsername(username);
        if (user) {
            while (isTokenOverLimit(user.platform, user.chatMessage)) {
                // 删除从第2条开始的消息(因为第一条是prompt)
                user.chatMessage.splice(1, 2);
            }
            user.chatMessage.push({
                role: ChatCompletionRequestMessageRoleEnum.User,
                content: message,
            });
        }
    }

    /**
     * 添加ChatGPT的回复
     * @param username
     * @param message
     */
    public addAssistantMessage(username: string, message: string): void {
        const user = this.getUserByUsername(username);
        if (user) {
            while (isTokenOverLimit(user.platform, user.chatMessage)) {
                // 删除从第2条开始的消息(因为第一条是prompt)
                user.chatMessage.splice(1, 2);
            }
            user.chatMessage.push({
                role: ChatCompletionRequestMessageRoleEnum.Assistant,
                content: message,
            });
        }
    }

    /**
     * 添加ChatGPT的回复
     * @param username
     * @param message
     */
    public addXunFeiAssistantMessage(username: string, message: XunFeiResponseData): void {
        const user = this.getUserByUsername(username);
        if (user) {
            if (message.isOverTokenLimit) {
                // 删除从第2条开始的消息(因为第一条是prompt)
                user.chatMessage.splice(0, 2);
            }
            user.chatMessage.push({
                role: ChatCompletionRequestMessageRoleEnum.Assistant,
                content: message.answer,
            });
        }
    }

    /**
     * 清空用户的聊天记录, 并将prompt设置为默认值
     * @param username
     */
    public clearHistory(username: string): void {
        const user = this.getUserByUsername(username);
        if (user) {
            // 讯飞没有prompt，chatgpt清除记录后设置默认的prompt
            user.chatMessage = user.platform === platform.CHATGPT ? [
                {
                    role: ChatCompletionRequestMessageRoleEnum.System,
                    content: "You are a helpful assistant."
                }
            ] : []
        }
    }

    public getAllData(): User[] {
        return DB.data;
    }
}

const DBUtils = new DB();
export default DBUtils;
