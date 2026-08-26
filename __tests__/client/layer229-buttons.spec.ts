import { buildReplyMarkup } from "../../gramjs/client/buttons";
import { Api } from "../../gramjs/tl";
import { Button } from "../../gramjs/tl/custom/button";
import { MessageButton } from "../../gramjs/tl/custom/messageButton";

describe("Layer 229 buttons", () => {
  test("builds inline button wrappers with typed payloads", () => {
    const callback = Button.inline("Approve", Buffer.from("approve"));
    const switchInline = Button.switchInline("Search", "query", true);
    const url = Button.url("Open", "https://example.com");
    const auth = Button.auth("Sign in", "https://example.com/auth");

    expect(callback).toBeInstanceOf(Api.KeyboardInlineButton);
    expect(callback.type).toBeInstanceOf(Api.InlineButtonTypeCallback);
    expect(switchInline.type).toBeInstanceOf(
      Api.InlineButtonTypeSwitchInline
    );
    expect(url.type).toBeInstanceOf(Api.InlineButtonTypeUrl);
    expect(auth.type).toBeInstanceOf(Api.InputInlineButtonTypeUrlAuth);

    for (const button of [callback, switchInline, url, auth]) {
      expect(button.getBytes().length).toBeGreaterThan(4);
      expect(Button._isInline(button)).toBe(true);
    }
  });

  test("builds keyboard button wrappers with typed payloads", () => {
    const text = Button.text("Text", true, true, true);
    const location = Button.requestLocation("Location");
    const phone = Button.requestPhone("Phone");
    const poll = Button.requestPoll("Poll");

    expect(text.button).toBeInstanceOf(Api.KeyboardButton);
    expect((text.button as Api.KeyboardButton).type).toBeInstanceOf(
      Api.ButtonTypeDefault
    );
    expect((location.button as Api.KeyboardButton).type).toBeInstanceOf(
      Api.ButtonTypeRequestGeoLocation
    );
    expect((phone.button as Api.KeyboardButton).type).toBeInstanceOf(
      Api.ButtonTypeRequestPhone
    );
    expect((poll.button as Api.KeyboardButton).type).toBeInstanceOf(
      Api.ButtonTypeRequestPoll
    );

    const markup = buildReplyMarkup([[text]]);
    expect(markup).toBeInstanceOf(Api.ReplyKeyboardMarkup);
    expect(markup).toMatchObject({
      resize: true,
      singleUse: true,
      selective: true,
    });
    expect((markup as Api.ReplyKeyboardMarkup).rows[0]).toBeInstanceOf(
      Api.KeyboardButtonRow
    );
  });

  test("builds dedicated inline rows and rejects mixed layouts", () => {
    const callback = Button.inline("Approve", Buffer.from("approve"));
    const markup = buildReplyMarkup([[callback]]);

    expect(markup).toBeInstanceOf(Api.ReplyInlineMarkup);
    expect((markup as Api.ReplyInlineMarkup).rows[0]).toBeInstanceOf(
      Api.KeyboardInlineButtonRow
    );
    expect(() =>
      buildReplyMarkup([[callback, Button.text("Text")]])
    ).toThrow("You cannot mix inline with normal buttons");
    expect(() => buildReplyMarkup([[Button.text("Text")]], true)).toThrow(
      "You cannot use non-inline buttons here"
    );
  });

  test("exposes nested inline button values through MessageButton", () => {
    const chat = new Api.InputPeerSelf();
    const callback = new MessageButton(
      {} as never,
      Button.inline("Approve", Buffer.from("approve")),
      chat,
      undefined,
      1
    );
    const switchInline = new MessageButton(
      {} as never,
      Button.switchInline("Search", "query"),
      chat,
      undefined,
      1
    );
    const url = new MessageButton(
      {} as never,
      Button.url("Open", "https://example.com"),
      chat,
      undefined,
      1
    );

    expect(callback.data).toEqual(Buffer.from("approve"));
    expect(switchInline.inlineQuery).toBe("query");
    expect(url.url).toBe("https://example.com");
  });
});
