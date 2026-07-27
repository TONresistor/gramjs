import bigInt from "big-integer";
import { getInputMedia } from "../../gramjs/Utils";
import { Api } from "../../gramjs/tl";
import { CustomMessage } from "../../gramjs/tl/custom/message";

const text = (value: string) =>
  new Api.TextWithEntities({
    text: value,
    entities: [],
  });

const answer = (label: string, option: number) =>
  new Api.PollAnswer({
    text: text(label),
    option: Buffer.from([option]),
  });

const poll = (answers: Api.TypePollAnswer[], quiz = false) =>
  new Api.Poll({
    id: bigInt.one,
    quiz,
    question: text("Question"),
    answers,
    hash: bigInt.zero,
  });

describe("poll compatibility", () => {
  test("converts quiz result options to zero-based answer indices", () => {
    const media = new Api.MessageMediaPoll({
      poll: poll(
        [answer("first", 10), answer("second", 20), answer("third", 30)],
        true
      ),
      results: new Api.PollResults({
        results: [
          new Api.PollAnswerVoters({
            correct: true,
            option: Buffer.from([20]),
          }),
          new Api.PollAnswerVoters({
            correct: true,
            option: Buffer.from([30]),
          }),
        ],
      }),
    });

    const input = getInputMedia(media);

    expect(input).toBeInstanceOf(Api.InputMediaPoll);
    expect((input as Api.InputMediaPoll).correctAnswers).toEqual([1, 2]);
  });

  test("clicks only concrete poll answers when the union includes input answers", async () => {
    const media = new Api.MessageMediaPoll({
      poll: poll([
        new Api.InputPollAnswer({
          text: text("draft"),
        }),
        answer("selectable", 42),
      ]),
      results: new Api.PollResults({}),
    });
    const message = new CustomMessage({
      id: 7,
      peerId: new Api.PeerUser({ userId: bigInt.one }),
      media,
    });
    const invoke = jest.fn(async (request) => request);
    message._client = { invoke } as any;
    message._inputChat = new Api.InputPeerSelf();

    expect(message.poll).toBe(media);
    await message.click({ i: 0 });

    expect(invoke).toHaveBeenCalledTimes(1);
    const request = invoke.mock.calls[0][0] as Api.messages.SendVote;
    expect(request.options).toEqual([Buffer.from([42])]);
  });

  test("uses the requested indices when clicking multiple poll answers", async () => {
    const media = new Api.MessageMediaPoll({
      poll: poll([
        answer("first", 10),
        answer("second", 20),
        answer("third", 30),
      ]),
      results: new Api.PollResults({}),
    });
    const message = new CustomMessage({
      id: 8,
      peerId: new Api.PeerUser({ userId: bigInt.one }),
      media,
    });
    const invoke = jest.fn(async (request) => request);
    message._client = { invoke } as any;
    message._inputChat = new Api.InputPeerSelf();

    await message.click({ i: [0, 2] });

    const request = invoke.mock.calls[0][0] as Api.messages.SendVote;
    expect(request.options).toEqual([
      Buffer.from([10]),
      Buffer.from([30]),
    ]);
  });
});
