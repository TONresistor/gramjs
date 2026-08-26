import type { ButtonLike, EntityLike } from "../../define";
import { Api } from "../api";
import { utils } from "../../";
import { betterConsoleLog } from "../../Helpers";
import { inspect } from "../../inspect";

export class Button {
    public button: ButtonLike;
    public resize: boolean | undefined;
    public selective: boolean | undefined;
    public singleUse: boolean | undefined;

    [inspect.custom]() {
        return betterConsoleLog(this);
    }

    constructor(
        button: Api.TypeKeyboardButton | Api.TypeKeyboardInlineButton,
        resize?: boolean,
        singleUse?: boolean,
        selective?: boolean
    ) {
        this.button = button;
        this.resize = resize;
        this.singleUse = singleUse;
        this.selective = selective;
    }

    static _isInline(
        button: ButtonLike
    ): button is Api.TypeKeyboardInlineButton {
        return button instanceof Api.KeyboardInlineButton;
    }

    static inline(text: string, data?: Buffer) {
        if (!data) {
            data = Buffer.from(text, "utf-8");
        }
        if (data.length > 64) {
            throw new Error("Too many bytes for the data");
        }
        return new Api.KeyboardInlineButton({
            text,
            type: new Api.InlineButtonTypeCallback({ data }),
        });
    }

    static switchInline(text: string, query = "", samePeer = false) {
        return new Api.KeyboardInlineButton({
            text,
            type: new Api.InlineButtonTypeSwitchInline({ query, samePeer }),
        });
    }

    static url(text: string, url?: string) {
        return new Api.KeyboardInlineButton({
            text,
            type: new Api.InlineButtonTypeUrl({ url: url || text }),
        });
    }

    static auth(
        text: string,
        url?: string,
        bot?: EntityLike,
        writeAccess?: boolean,
        fwdText?: string
    ) {
        return new Api.KeyboardInlineButton({
            text,
            type: new Api.InputInlineButtonTypeUrlAuth({
                url: url || text,
                bot: utils.getInputUser(bot || new Api.InputUserSelf()),
                requestWriteAccess: writeAccess,
                fwdText,
            }),
        });
    }

    static text(
        text: string,
        resize?: boolean,
        singleUse?: boolean,
        selective?: boolean
    ) {
        return new this(
            new Api.KeyboardButton({
                text,
                type: new Api.ButtonTypeDefault(),
            }),
            resize,
            singleUse,
            selective
        );
    }

    static requestLocation(
        text: string,
        resize?: boolean,
        singleUse?: boolean,
        selective?: boolean
    ) {
        return new this(
            new Api.KeyboardButton({
                text,
                type: new Api.ButtonTypeRequestGeoLocation(),
            }),
            resize,
            singleUse,
            selective
        );
    }

    static requestPhone(
        text: string,
        resize?: boolean,
        singleUse?: boolean,
        selective?: boolean
    ) {
        return new this(
            new Api.KeyboardButton({
                text,
                type: new Api.ButtonTypeRequestPhone(),
            }),
            resize,
            singleUse,
            selective
        );
    }

    static requestPoll(
        text: string,
        resize?: boolean,
        singleUse?: boolean,
        selective?: boolean
    ) {
        return new this(
            new Api.KeyboardButton({
                text,
                type: new Api.ButtonTypeRequestPoll({}),
            }),
            resize,
            singleUse,
            selective
        );
    }

    static clear() {
        return new Api.ReplyKeyboardHide({});
    }

    static forceReply() {
        return new Api.ReplyKeyboardForceReply({});
    }
}
