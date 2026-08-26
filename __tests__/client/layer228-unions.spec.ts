import bigInt from "big-integer";
import { EntityCache } from "../../gramjs/entityCache";
import { _EntityType, _entityType } from "../../gramjs/Helpers";
import { _DialogsIter } from "../../gramjs/client/dialogs";
import { _ParticipantsIter } from "../../gramjs/client/chats";
import {
  _getInputDialog,
  _getInputNotify,
} from "../../gramjs/client/users";
import { MemorySession } from "../../gramjs/sessions";
import { Api } from "../../gramjs/tl";
import {
  getDisplayName,
  getInputChannel,
  getInputPeer,
  getPeerId,
} from "../../gramjs/Utils";

function community(options: {
  id?: number;
  accessHash?: number;
  min?: boolean;
  title?: string;
} = {}) {
  return new Api.Community({
    id: bigInt(options.id ?? 42),
    accessHash:
      options.accessHash === undefined
        ? undefined
        : bigInt(options.accessHash),
    min: options.min,
    title: options.title ?? "Community",
    photo: new Api.ChatPhotoEmpty(),
    date: 0,
  });
}

describe("Layer 228 high-level unions", () => {
  test("community entities behave like channels in public helpers", () => {
    const entity = community({ accessHash: 99, title: "Builders" });

    const inputPeer = getInputPeer(entity);
    expect(inputPeer).toBeInstanceOf(Api.InputPeerChannel);
    expect(inputPeer).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt(99),
    });

    const inputChannel = getInputChannel(entity);
    expect(inputChannel).toBeInstanceOf(Api.InputChannel);
    expect(inputChannel).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt(99),
    });

    expect(getPeerId(entity)).toBe("-10042");
    expect(getDisplayName(entity)).toBe("Builders");
    expect(_entityType(entity)).toBe(_EntityType.CHANNEL);
  });

  test("community input peers enforce access hash and min rules", () => {
    expect(() => getInputPeer(community())).toThrow(
      "Community without accessHash or min info cannot be input"
    );
    expect(() =>
      getInputPeer(community({ accessHash: 99, min: true }))
    ).toThrow("Community without accessHash or min info cannot be input");

    const unchecked = getInputPeer(community(), true, false);
    expect(unchecked).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt.zero,
    });

    const forbidden = new Api.CommunityForbidden({
      id: bigInt(43),
      accessHash: bigInt(100),
      title: "Private builders",
    });
    expect(getInputPeer(forbidden)).toMatchObject({
      channelId: bigInt(43),
      accessHash: bigInt(100),
    });
    expect(getDisplayName(forbidden)).toBe("Private builders");

    const forbiddenWithoutHash = new Api.CommunityForbidden({
      id: bigInt(44),
      title: "Unavailable",
    });
    expect(() => getInputPeer(forbiddenWithoutHash)).toThrow(
      "CommunityForbidden without accessHash cannot be input"
    );
  });

  test("community container and full objects expose channel peer IDs", () => {
    const full = new Api.CommunityFull({
      id: bigInt(45),
      about: "Community",
      chatPhoto: new Api.PhotoEmpty({ id: bigInt(45) }),
      linkedPeers: [],
    });
    const dialog = new Api.DialogCommunity({
      communityId: bigInt(46),
      notifySettings: new Api.PeerNotifySettings({}),
    });
    const dialogPeer = new Api.DialogPeerCommunity({
      communityId: bigInt(47),
    });

    expect(getPeerId(full)).toBe("-10045");
    expect(getPeerId(dialog as any)).toBe("-10046");
    expect(getPeerId(dialogPeer as any)).toBe("-10047");
  });

  test("community entities are retained by runtime and session caches", () => {
    const entity = community({ accessHash: 99 });
    const cache = new EntityCache();
    cache.add([entity]);
    expect(cache.get("-10042")).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt(99),
    });

    const session = new MemorySession();
    session.processEntities(
      new Api.messages.Chats({
        chats: [entity],
      })
    );
    expect(session.getInputEntity("-10042")).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt(99),
    });
  });

  test("community dialog and notification inputs resolve without nesting", async () => {
    const entity = community({ accessHash: 99 });
    const getInputEntity = jest.fn(async (value) => getInputPeer(value));
    const client = { getInputEntity };

    const rawDialog = await _getInputDialog(client as any, entity);
    expect(rawDialog).toBeInstanceOf(Api.InputDialogPeerCommunity);
    expect(rawDialog.community).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt(99),
    });

    const dialog = new Api.InputDialogPeerCommunity({
      community: entity as unknown as Api.TypeInputChannel,
    });
    const resolvedDialog = await _getInputDialog(client as any, dialog);
    expect(resolvedDialog).toBe(dialog);
    expect(resolvedDialog.community).toBeInstanceOf(Api.InputChannel);

    const folder = new Api.InputDialogPeerFolder({ folderId: 1 });
    expect(await _getInputDialog(client as any, folder)).toBe(folder);

    const rawNotify = await _getInputNotify(client as any, entity);
    expect(rawNotify).toBeInstanceOf(Api.InputNotifyCommunity);
    expect(rawNotify.community).toMatchObject({
      channelId: bigInt(42),
      accessHash: bigInt(99),
    });

    const notify = new Api.InputNotifyCommunity({
      community: entity as unknown as Api.TypeInputChannel,
    });
    const resolvedNotify = await _getInputNotify(client as any, notify);
    expect(resolvedNotify).toBe(notify);
    expect(resolvedNotify.community).toBeInstanceOf(Api.InputChannel);
  });

  test("dialog pagination skips community entries in a mixed response", async () => {
    const community = new Proxy(
      new Api.DialogCommunity({
        communityId: bigInt.one,
        notifySettings: new Api.PeerNotifySettings({}),
      }),
      {
        get(target, property, receiver) {
          if (property === "peer" || property === "topMessage") {
            throw new Error(`${String(property)} must not be read`);
          }
          return Reflect.get(target, property, receiver);
        },
      }
    );
    const response = new Api.messages.DialogsSlice({
      count: 2,
      dialogs: [
        new Api.Dialog({
          peer: new Api.PeerUser({ userId: bigInt.one }),
          topMessage: 1,
          readInboxMaxId: 0,
          readOutboxMaxId: 0,
          unreadCount: 0,
          unreadMentionsCount: 0,
          unreadReactionsCount: 0,
          unreadPollVotesCount: 0,
          notifySettings: new Api.PeerNotifySettings({}),
        }),
        community,
      ],
      messages: [],
      chats: [
        new Api.Community({
          id: bigInt.one,
          title: "community",
          photo: new Api.ChatPhotoEmpty(),
          date: 0,
        }),
        new Api.CommunityForbidden({
          id: bigInt(2),
          title: "forbidden community",
        }),
      ],
      users: [],
    });
    const client = {
      invoke: jest.fn(async () => response),
    };
    const iterator = new _DialogsIter(
      client as any,
      2,
      {},
      {
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        ignorePinned: false,
        ignoreMigrated: false,
        folder: undefined,
      }
    );

    const dialogs = await iterator.collect();

    expect(dialogs).toHaveLength(0);
    expect(client.invoke).toHaveBeenCalledTimes(1);
  });

  test("participant totals do not read channel-only fields from CommunityFull", async () => {
    const community = new Proxy(
      new Api.CommunityFull({
        id: bigInt.one,
        about: "community",
        chatPhoto: new Api.PhotoEmpty({ id: bigInt.one }),
        linkedPeers: [],
      }),
      {
        get(target, property, receiver) {
          if (property === "participantsCount") {
            throw new Error("participantsCount must not be read");
          }
          return Reflect.get(target, property, receiver);
        },
      }
    );
    const full = new Api.messages.ChatFull({
      fullChat: community,
      chats: [],
      users: [],
    });
    const participants = new Api.channels.ChannelParticipants({
      count: 0,
      participants: [],
      chats: [],
      users: [],
    });
    const client = {
      getInputEntity: jest.fn(
        async () =>
          new Api.InputChannel({
            channelId: bigInt.one,
            accessHash: bigInt.one,
          })
      ),
      invoke: jest
        .fn()
        .mockResolvedValueOnce(full)
        .mockResolvedValueOnce(participants),
    };
    const iterator = new _ParticipantsIter(
      client as any,
      10,
      {},
      {
        entity: new Api.InputChannel({
          channelId: bigInt.one,
          accessHash: bigInt.one,
        }),
        filter: undefined,
        offset: 0,
        search: undefined,
        showTotal: true,
      }
    );

    const result = await iterator.collect();

    expect(result).toHaveLength(0);
    expect(client.invoke).toHaveBeenCalledTimes(2);
  });
});
