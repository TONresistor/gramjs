"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReplyMarkup = buildReplyMarkup;
const tl_1 = require("../tl");
const button_1 = require("../tl/custom/button");
const messageButton_1 = require("../tl/custom/messageButton");
const Helpers_1 = require("../Helpers");
// ButtonMethods
/** @hidden */
function buildReplyMarkup(buttons, inlineOnly = false) {
    if (buttons == undefined) {
        return undefined;
    }
    if ("SUBCLASS_OF_ID" in buttons) {
        if (buttons.SUBCLASS_OF_ID == 0xe2e10ef2) {
            return buttons;
        }
    }
    if (!(0, Helpers_1.isArrayLike)(buttons)) {
        buttons = [[buttons]];
    }
    else if (!buttons || !(0, Helpers_1.isArrayLike)(buttons[0])) {
        // @ts-ignore
        buttons = [buttons];
    }
    let isInline = false;
    let isNormal = false;
    let resize = undefined;
    let singleUse = false;
    let selective = false;
    const inlineRows = [];
    const normalRows = [];
    // @ts-ignore
    for (const row of buttons) {
        const inlineButtons = [];
        const normalButtons = [];
        for (let button of row) {
            if (button instanceof button_1.Button) {
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
            }
            else if (button instanceof messageButton_1.MessageButton) {
                button = button.button;
            }
            const inline = button_1.Button._isInline(button);
            if (inline) {
                isInline = true;
                inlineButtons.push(button);
            }
            else if (button instanceof tl_1.Api.KeyboardButton) {
                isNormal = true;
                normalButtons.push(button);
            }
        }
        if (inlineButtons.length) {
            inlineRows.push(new tl_1.Api.KeyboardInlineButtonRow({ buttons: inlineButtons }));
        }
        if (normalButtons.length) {
            normalRows.push(new tl_1.Api.KeyboardButtonRow({ buttons: normalButtons }));
        }
    }
    if (inlineOnly && isNormal) {
        throw new Error("You cannot use non-inline buttons here");
    }
    else if (isInline === isNormal && isNormal) {
        throw new Error("You cannot mix inline with normal buttons");
    }
    else if (isInline) {
        return new tl_1.Api.ReplyInlineMarkup({
            rows: inlineRows,
        });
    }
    return new tl_1.Api.ReplyKeyboardMarkup({
        rows: normalRows,
        resize: resize,
        singleUse: singleUse,
        selective: selective,
    });
}
