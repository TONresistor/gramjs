import { Api } from "../tl";
import type { ButtonLike } from "../define";
import { Button } from "../tl/custom/button";
import { MessageButton } from "../tl/custom/messageButton";
import { isArrayLike } from "../Helpers";

// ButtonMethods
/** @hidden */
export function buildReplyMarkup(
    buttons:
        | Api.TypeReplyMarkup
        | undefined
        | ButtonLike
        | ButtonLike[]
        | ButtonLike[][],
    inlineOnly: boolean = false
): Api.TypeReplyMarkup | undefined {
    if (buttons == undefined) {
        return undefined;
    }
    if ("SUBCLASS_OF_ID" in buttons) {
        if (buttons.SUBCLASS_OF_ID == 0xe2e10ef2) {
            return buttons;
        }
    }
    if (!isArrayLike(buttons)) {
        buttons = [[buttons]];
    } else if (!buttons || !isArrayLike(buttons[0])) {
        // @ts-ignore
        buttons = [buttons];
    }
    let isInline = false;
    let isNormal = false;
    let resize = undefined;
    let singleUse = false;
    let selective = false;

    const inlineRows: Api.TypeKeyboardInlineButtonRow[] = [];
    const normalRows: Api.TypeKeyboardButtonRow[] = [];
    // @ts-ignore
    for (const row of buttons) {
        const inlineButtons: Api.TypeKeyboardInlineButton[] = [];
        const normalButtons: Api.TypeKeyboardButton[] = [];
        for (let button of row) {
            if (button instanceof Button) {
                if (button.resize != undefined) {
                    resize = button.resize;
                }
                if (button.singleUse != undefined) {
                    singleUse = button.singleUse;
                }
                if (button.selective != undefined) {
                    selective = button.selective;
                }
                button = button.button;
            } else if (button instanceof MessageButton) {
                button = button.button;
            }
            const inline = Button._isInline(button);
            if (inline) {
                isInline = true;
                inlineButtons.push(button);
            } else if (button instanceof Api.KeyboardButton) {
                isNormal = true;
                normalButtons.push(button);
            }
        }
        if (inlineButtons.length) {
            inlineRows.push(
                new Api.KeyboardInlineButtonRow({ buttons: inlineButtons })
            );
        }
        if (normalButtons.length) {
            normalRows.push(new Api.KeyboardButtonRow({ buttons: normalButtons }));
        }
    }
    if (inlineOnly && isNormal) {
        throw new Error("You cannot use non-inline buttons here");
    } else if (isInline === isNormal && isNormal) {
        throw new Error("You cannot mix inline with normal buttons");
    } else if (isInline) {
        return new Api.ReplyInlineMarkup({
            rows: inlineRows,
        });
    }
    return new Api.ReplyKeyboardMarkup({
        rows: normalRows,
        resize: resize,
        singleUse: singleUse,
        selective: selective,
    });
}
