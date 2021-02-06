---
layout: page
title: Getting started with Earthball
---

Create a new Earthball site with the `earthball new` command.

Earthball depends on recent node versions (it's developed with node 15), so first make sure you've got node installed.

You might use [nvm](https://github.com/nvm-sh/nvm) to install multiple node versions.

After you've got node installed, create a directory for your new site:

```shell
mkdir cool-new-site
```

And move into that directory:

```shell
cd cool-new-site
```

Next run `npm init` and install earthball with npm:

```shell
npm init
npm install earthball --dev
```

Finally, create the site with `earthball new`, which takes `title` and `description` arguments:

```shell
earthball new --title "cool site" --description "cool earthball site"
```
