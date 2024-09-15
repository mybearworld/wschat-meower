# wschat-meower

A Meower client within wsChat!

To start using this client:

- Add this bookmarklet to enable/disable Meower mode:
  ```
  javascript:localStorage.server?delete localStorage.server:localStorage.server="ws://localhost:8000";location.reload()
  ```
- Clone or download this repository.
  ```
  git clone https://github.com/mybearworld/wschat-meower.git
  cd wschat-meower
  ```
- Start the server.
  ```
  $ deno task start
  Listening on http://0.0.0.0:1234/
  ```
- Open [wsChat](https://wlodekm.nekoweb.org/wsChat/client).
- Click on the "Change server" button and enter the URL you got above.
