This is a generals.io bot. 

got to [dev.generals.io](http://dev.generals.io/) to learn about it.

# Configuration

To configure a particular deployment, create a `config.json` based on
[`config.json.example`](config.json.example). To enable secure
deployment, you may place the `config.json` in a parent
directory. [`confuse`](https://github.com/substack/node-confuse) is
used to load configuration.

The keys are all placed inside of the `"generalsio-bot-kpg"` key. The
keys of that are the following:

* `userId` (`String`): The secret your bot uses to connect to the
  Generals bot server. You should not commit this to your git
  repository or place this in a public location. To make a new
  account, simply generate a new random string.

* `userName` (`String`): The username to use. When you connect with a
  new `userId` for the first time, this will control the nick the bot
  claims.

* `customGameId` (optional `String`): If set, chooses the “custom game” gaming
  mode where the bot joins
  `http://bot.generals.io/games/«customGameId»` and waits for a human
  (you?) to join and start the game. This setting’s presence overrides
  free for all (`freeForAll`).

* `freeForAll` (`Boolean` defaults to `false`): If set and `true` and
  if `customGameId` is unspecified, chooses the “free for all” game
  mode. If unset or `false`, the 1v1 (“one versus one”) game mode is
  used instead.

