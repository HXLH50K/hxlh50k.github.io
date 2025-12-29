---
layout: post
title: Quickly Sync Proxy Nodes with a GitHub Gist Subscription
description: A simplified guide to using a private GitHub Gist for managing and syncing your personal proxy nodes across devices.
excerpt: This is a straightforward method to host your personal node links (like vmess:// or vless://) in a private GitHub Gist and use its raw URL as a subscription link for easy setup and updates.
date: 2025-12-29
author: hxlh50k
header-img: null
catalog: true
tags:
    - Gist
    - GitHub
    - Proxy
    - Subscription
    - Tools
---

Here is a simple way to manage your personal proxy nodes across multiple devices using a GitHub Gist as a subscription source.

**Note:** This method is for personal convenience. While "secret" gists are not publicly searchable, anyone with the link can view the content.

### Step 1: Get Your Node Links

Export the share links for your existing nodes from your client application. They will look something like this, with each link on a new line:

```
vmess://a2Jc47d...
vless://b8dE58f...
ss://c9fF69g...
```

### Step 2: Create a Secret Gist

1.  Go to [gist.github.com](https://gist.github.com/).
2.  Paste all your node links into the main content area, one link per line.
3.  Give it a filename, such as `nodes.txt`.
4.  Instead of "Create public gist," click the dropdown arrow and select **"Create secret gist"**.

### Step 3: Use the Raw Link as a Subscription

1.  After creating the gist, click the **"Raw"** button on your file.
2.  Copy the URL directly from your browser's address bar.
3.  Paste this URL into the subscription field in your client application on any device.

To update your nodes, simply edit the Gist. Your clients will fetch the changes the next time they update subscriptions.
