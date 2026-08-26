import bigInt from "big-integer";
import semanticDiff from "../../telegram-schema-diff.json";
import { BinaryReader } from "../../gramjs/extensions/BinaryReader";
import { Api } from "../../gramjs/tl";
import { LAYER, tlobjects } from "../../gramjs/tl/AllTLObjects";

type ApiClass = {
  CONSTRUCTOR_ID: number;
};

function toClassName(name: string) {
  return name
    .replace(/(?:^|_)([a-z])/g, (_, letter: string) => letter.toUpperCase())
    .replace(/_/g, "");
}

function getApiClass(definitionName: string): ApiClass {
  const parts = definitionName.split(".");
  const name = toClassName(parts.pop() as string);
  let current = Api as unknown as Record<string, unknown>;

  for (const namespace of parts) {
    const next = current[namespace];
    if (!next || typeof next !== "object") {
      throw new Error(`Missing API namespace for ${definitionName}`);
    }
    current = next as Record<string, unknown>;
  }

  const apiClass = current[name];
  if (
    typeof apiClass !== "function" ||
    typeof (apiClass as unknown as ApiClass).CONSTRUCTOR_ID !== "number"
  ) {
    throw new Error(`Missing API class for ${definitionName}`);
  }
  return apiClass as unknown as ApiClass;
}

describe("Telegram API Layer 229", () => {
  test("exports the expected layer and protocol-critical constructor IDs", () => {
    expect(LAYER).toBe(229);
    expect(Api.User.CONSTRUCTOR_ID >>> 0).toBe(0xb1b8cc83);
    expect(Api.Channel.CONSTRUCTOR_ID >>> 0).toBe(0xd49f34c6);
    expect(Api.Message.CONSTRUCTOR_ID >>> 0).toBe(0x7600b9d3);
    expect(Api.messages.SearchGlobal.CONSTRUCTOR_ID >>> 0).toBe(0x6126a43c);
    expect(Api.messages.ChatInviteJoinResultOk.CONSTRUCTOR_ID >>> 0).toBe(
      0x445663a7
    );

    expect(tlobjects[Api.User.CONSTRUCTOR_ID]).toBe(Api.User);
    expect(tlobjects[Api.Channel.CONSTRUCTOR_ID]).toBe(Api.Channel);
    expect(tlobjects[Api.Message.CONSTRUCTOR_ID]).toBe(Api.Message);
    expect(tlobjects[Api.messages.SearchGlobal.CONSTRUCTOR_ID]).toBe(
      Api.messages.SearchGlobal
    );
    expect(tlobjects[Api.messages.ChatInviteJoinResultOk.CONSTRUCTOR_ID]).toBe(
      Api.messages.ChatInviteJoinResultOk
    );
  });

  test("registers all 32 changed definitions only under their Layer 229 IDs", () => {
    const changedIds = semanticDiff.cumulative.modified.filter(
      (definition) => definition.before.id !== definition.after.id
    );

    expect(changedIds).toHaveLength(32);
    for (const definition of changedIds) {
      const apiClass = getApiClass(definition.name);
      const oldId = Number.parseInt(definition.before.id.slice(2), 16);
      const newId = Number.parseInt(definition.after.id.slice(2), 16);

      expect(apiClass.CONSTRUCTOR_ID >>> 0).toBe(newId);
      expect(tlobjects[newId]).toBe(apiClass);
      expect(tlobjects[oldId]).not.toBe(apiClass);
    }
  });

  test("serializes search and message requests without new optional fields", () => {
    const search = new Api.messages.SearchGlobal({
      q: "layer-229",
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: 0,
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 10,
    });
    const send = new Api.messages.SendMessage({
      peer: new Api.InputPeerSelf(),
      message: "test",
      randomId: bigInt.one,
    });
    const edit = new Api.messages.EditMessage({
      peer: new Api.InputPeerSelf(),
      id: 1,
      message: "edited",
    });
    const editInline = new Api.messages.EditInlineBotMessage({
      id: new Api.InputBotInlineMessageID({
        dcId: 1,
        id: bigInt.one,
        accessHash: bigInt.one,
      }),
      message: "edited",
    });

    for (const request of [search, send, edit, editInline]) {
      expect(request.getBytes().length).toBeGreaterThan(4);
    }
  });

  test("represents invite joins with the Layer 228 result wrapper", () => {
    const updates = new Api.Updates({
      updates: [],
      users: [],
      chats: [],
      date: 0,
      seq: 0,
    });
    const result = new Api.messages.ChatInviteJoinResultOk({ updates });
    const request = new Api.messages.ImportChatInvite({ hash: "invite" });

    expect(result.updates).toBe(updates);
    expect(result.getBytes().length).toBeGreaterThan(4);
    expect(request.getBytes().length).toBeGreaterThan(4);
  });

  test("preserves Layer 228 rich messages on the custom Message class", () => {
    const richMessage = new Api.RichMessage({
      part: true,
      blocks: [
        new Api.PageBlockParagraph({
          text: new Api.TextPlain({ text: "Rich content" }),
        }),
      ],
      photos: [],
      documents: [],
    });
    const message = new Api.Message({
      id: 1,
      peerId: new Api.PeerUser({ userId: bigInt.one }),
      date: 0,
      message: "",
      richMessage,
    });

    expect(message.richMessage).toBe(richMessage);
    expect(message.richMessage?.part).toBe(true);

    const decoded = new BinaryReader(message.getBytes()).tgReadObject() as Api.Message;
    expect(decoded.richMessage).toBeInstanceOf(Api.RichMessage);
    expect(decoded.richMessage?.part).toBe(true);
    expect(decoded.richMessage?.blocks[0]).toBeInstanceOf(Api.PageBlockParagraph);
  });
});
