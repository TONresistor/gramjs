import type { TelegramClient } from "../../client/TelegramClient";
import type { ButtonLike, EntityLike, MessageIDLike } from "../../define";
import { Api } from "../api";
import { Button } from "./button";
import { betterConsoleLog } from "../../Helpers";
import { computeCheck } from "../../Password";
import { inspect } from "../../inspect";

export class MessageButton {
    private readonly _client: TelegramClient;
    private readonly _chat: EntityLike;
    public readonly button: ButtonLike;
    private readonly _bot?: EntityLike;
    private readonly _msgId: MessageIDLike;

    [inspect.custom]() {
        return betterConsoleLog(this);
    }

    constructor(
        client: TelegramClient,
        original: ButtonLike,
        chat: EntityLike,
        bot: EntityLike | undefined,
        msgId: MessageIDLike
    ) {
        this.button = original;
        this._bot = bot;
        this._chat = chat;
        this._msgId = msgId;
        this._client = client;
    }

    get client() {
        return this._client;
    }

    get text() {
        return !(this.button instanceof Button) ? this.button.text : "";
    }

    private get _inlineType() {
        if (this.button instanceof Api.KeyboardInlineButton) {
            return this.button.type;
        }
    }

    private get _keyboardType() {
        if (this.button instanceof Api.KeyboardButton) {
            return this.button.type;
        }
    }

    get data() {
        const type = this._inlineType;
        if (type instanceof Api.InlineButtonTypeCallback) {
            return type.data;
        }
    }

    get inlineQuery() {
        const type = this._inlineType;
        if (type instanceof Api.InlineButtonTypeSwitchInline) {
            return type.query;
        }
    }

    get url() {
        const type = this._inlineType;
        if (
            type instanceof Api.InlineButtonTypeUrl ||
            type instanceof Api.InlineButtonTypeUrlAuth ||
            type instanceof Api.InputInlineButtonTypeUrlAuth ||
            type instanceof Api.InlineButtonTypeWebView
        ) {
            return type.url;
        }
    }

    /**
     * Emulates the behaviour of clicking this button.

     If it's a normal `KeyboardButton` with text, a message will be
     sent, and the sent `Message <Message>` returned.

     If it's an `InlineButtonTypeCallback` with text and data,
     it will be "clicked" and the `BotCallbackAnswer` returned.

     If it's an `InlineButtonTypeSwitchInline` button, the
     `StartBot` will be invoked and the resulting updates
     returned.

     If it's an `InlineButtonTypeUrl`, the URL of the button will
     be returned.

     If it's a `ButtonTypeRequestPhone`, you must indicate that you
     want to ``sharePhone=True`` in order to share it. Sharing it is not a
     default because it is a privacy concern and could happen accidentally.

     You may also use ``sharePhone=phone`` to share a specific number, in
     which case either `str` or `InputMediaContact` should be used.

     If it's a `ButtonTypeRequestGeoLocation`, you must pass a
     tuple in ``shareGeo=[longitude, latitude]``. Note that Telegram seems
     to have some heuristics to determine impossible locations, so changing
     this value a lot quickly may not work as expected. You may also pass a
     `InputGeoPoint` if you find the order confusing.
     */
    async click({
        sharePhone = false,
        shareGeo = [0, 0],
        password,
    }: {
        sharePhone?: boolean | string | Api.InputMediaContact;
        shareGeo?: [number, number] | Api.InputMediaGeoPoint;
        password?: string;
    }) {
        const keyboardType = this._keyboardType;
        const inlineType = this._inlineType;
        if (keyboardType instanceof Api.ButtonTypeDefault) {
            return this._client.sendMessage(this._chat, {
                message: this.text,
                parseMode: undefined,
            });
        } else if (inlineType instanceof Api.InlineButtonTypeCallback) {
            let encryptedPassword;
            if (password != undefined) {
                const pwd = await this.client.invoke(
                    new Api.account.GetPassword()
                );
                encryptedPassword = await computeCheck(pwd, password);
            }
            const request = new Api.messages.GetBotCallbackAnswer({
                peer: this._chat,
                msgId: this._msgId,
                data: inlineType.data,
                password: encryptedPassword,
            });
            try {
                return await this._client.invoke(request);
            } catch (e: any) {
                if (e.errorMessage == "BOT_RESPONSE_TIMEOUT") {
                    return null;
                }
                throw e;
            }
        } else if (inlineType instanceof Api.InlineButtonTypeSwitchInline) {
            return this._client.invoke(
                new Api.messages.StartBot({
                    bot: this._bot,
                    peer: this._chat,
                    startParam: inlineType.query,
                })
            );
        } else if (
            inlineType instanceof Api.InlineButtonTypeUrl ||
            inlineType instanceof Api.InlineButtonTypeUrlAuth ||
            inlineType instanceof Api.InputInlineButtonTypeUrlAuth ||
            inlineType instanceof Api.InlineButtonTypeWebView
        ) {
            return inlineType.url;
        } else if (inlineType instanceof Api.InlineButtonTypeGame) {
            const request = new Api.messages.GetBotCallbackAnswer({
                peer: this._chat,
                msgId: this._msgId,
                game: true,
            });
            try {
                return await this._client.invoke(request);
            } catch (e: any) {
                if (e.errorMessage == "BOT_RESPONSE_TIMEOUT") {
                    return null;
                }
                throw e;
            }
        } else if (keyboardType instanceof Api.ButtonTypeRequestPhone) {
            if (!sharePhone) {
                throw new Error(
                    "cannot click on phone buttons unless sharePhone=true"
                );
            }
            if (sharePhone == true || typeof sharePhone == "string") {
                const me = await this._client.getMe();
                sharePhone = new Api.InputMediaContact({
                    phoneNumber:
                        (sharePhone == true ? me.phone : sharePhone) || "",
                    firstName: me.firstName || "",
                    lastName: me.lastName || "",
                    vcard: "",
                });
            }
            throw new Error("Not supported for now");
            // TODO
            //return this._client.sendFile(this._chat, phoneMedia);
        } else if (keyboardType instanceof Api.ButtonTypeRequestGeoLocation) {
            if (!shareGeo) {
                throw new Error(
                    "cannot click on geo buttons unless shareGeo=[longitude, latitude]"
                );
            }
            throw new Error("Not supported for now");
            // TODO

            //return this._client.sendFile(this._chat, geoMedia);
        }
    }
}
