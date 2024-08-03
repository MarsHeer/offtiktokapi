# Offtiktok | The Open TikTok Client

Offtiktok allows users to share tiktoks with anyone, regardless of whether they have the app or not, by adding "off" before "tiktok" in the url (e.g: [https://vm.offtiktok.com/ZGe7XpCwV/](https://vm.offtiktok.com/ZGe7XpCwV/) )

It also includes a minimalistic TikTok feed that allows watching videos recommended by the platform, no ads, no app, no geo-restrictions.

### This repository includes the backend server. [If you're looking for the front-end, it's here](https://github.com/MarsHeer/offtiktok)

## Deploy it yourself

This backend is built in node.js and can be quite simply deployed:

### 1. Install Node & npm (or your package manager of preference)

#### macOS

1.  **Using Homebrew**:

    - Install Homebrew if you haven't already:

      ```
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      ```

    - Install Node.js and npm:
      `brew  install  node`
          brew  install  node

2.  **Using Node Version Manager (nvm)**:

    - Install `nvm`:

      ```
        curl  -o-  https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
      ```

    - Load `nvm`:

      ```
      export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s
      "${XDG_CONFIG_HOME}/nvm")"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
      ```

    - Install Node.js:

      ```
      nvm  install  node
      ```

#### Linux

1.  **Using NodeSource Binaries**:

    - Install Node.js and npm:

      ```
      curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ```

2.  **Using Node Version Manager (nvm)**:

    - Install `nvm`:

      ```
        curl  -o-  https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
      ```

    - Load `nvm`:

      ```
      export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s
      "${XDG_CONFIG_HOME}/nvm")"
      [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
      ```

    - Install Node.js:

      `nvm  install  node`

#### Windows

1.  **Using Node.js Installer**:

    - Download the Windows installer from the Node.js website.
    - Run the installer and follow the prompts.
    -

2.  **Using Node Version Manager for Windows (nvm-windows)**:

    - Download and install `nvm-windows` from the nvm-windows releases.
    - Install Node.js:
      ```
      nvm  install  latest
      nvm  use  latest
      ```

After installation, verify that Node.js and npm are installed correctly by running:

```
node  -v
npm  -v
```

### 2. Install dependencies

To instal project dependencies, run: `npm install`

### 3. Configure your .env

Create a `.env` file and copy the contets of the `.env.template` file included in the repository.

Give your prisma DB a name

### 4. Apply prisma migrations

Before your initial development run, you need to apply the prisma migrations, run: `npx prisma migrate dev`

### 5. Ready for dev!

Run `npm run dev` to get your development server running in port `2000`

## Other scripts and important steps

The repository also includes a `npm run build` and `npm run start` scripts.
These are intended for development servers,
`npm run build` will compile your typescript and apply any missing prisma migrations.
`npm run start` will start up the compiled `index.ts` on your server

Need features like service permanence and startup scripts? [Check out pm2](https://pm2.keymetrics.io/)

# Collaborating

Collaborations are welcome! Please feel free to support the project by creating requests or pull requests

# License

This project is licensed under the MIT License
