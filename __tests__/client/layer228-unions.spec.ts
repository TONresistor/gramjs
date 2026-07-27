import bigInt from "big-integer";
import { _DialogsIter } from "../../gramjs/client/dialogs";
import { _ParticipantsIter } from "../../gramjs/client/chats";
import { Api } from "../../gramjs/tl";

describe("Layer 228 high-level unions", () => {
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
