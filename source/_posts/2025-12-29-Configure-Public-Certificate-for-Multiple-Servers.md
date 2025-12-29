---
layout: post
title: Configure a Single Public Certificate for Multiple Servers
description: A guide on using acme.sh and the DNS API to configure and auto-renew a single wildcard SSL certificate for multiple servers.
excerpt: This article documents the detailed steps for requesting and renewing a wildcard SSL certificate for the same domain on multiple servers (using Azure as an example) with acme.sh and the DNS API, and illustrates how to configure the service with Hysteria2.
date: 2025-12-29
author: hxlh50k
header-img: null
catalog: true
tags:
    - acme.sh
    - SSL
    - Hysteria2
    - Azure
    - Certificate
    - Proxy
    - Tools
    - Ubuntu
---

This article documents the process of using `acme.sh` and a DNS API to issue and renew a wildcard SSL certificate for the same domain across multiple servers.

## Prerequisites

- A domain name, e.g., `abc.org`
- One or more servers
- Each server will eventually have its own subdomain, e.g., `us1.abc.org`, `jp2.abc.org`

## 1. Obtain DNS Provider API Credentials

This step varies depending on the DNS provider. This article uses Microsoft Azure as an example.

1.  Log in to Azure Cloud Shell.
2.  Get your Subscription ID:
    ```bash
    az account show
    ```
3.  Create a Service Principal and obtain its credentials. Replace `<SubscriptionID>` with the ID obtained in the previous step.
    ```bash
    az ad sp create-for-rbac --name "AcmeDNSUpdater" --role "DNS Zone Contributor" --scopes /subscriptions/<SubscriptionID>
    ```
4.  You will receive a JSON output similar to the following. Keep the `appId`, `password`, and `tenant` values safe.
    ```json
    {
      "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "displayName": "AcmeDNSUpdater",
      "password": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
    ```

## 2. Issue the Certificate on the Server

Execute the following steps on **each** server where the certificate needs to be configured.

1.  Switch to the `root` user. Using `sudo` may cause permission issues during subsequent certificate renewals.
2.  Set the credentials obtained in the previous step as environment variables.
    ```bash
    export AZUREDNS_SUBSCRIPTIONID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    export AZUREDNS_TENANTID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    export AZUREDNS_APPID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    export AZUREDNS_CLIENTSECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    ```
    > **Note**: After the first successful use of the DNS API, `acme.sh` will save the credentials encrypted in `~/.acme.sh/account.conf`. Therefore, these environment variables are only needed for the initial certificate issuance; subsequent renewal jobs will automatically load the saved credentials.
3.  Install `acme.sh`.
    ```bash
    curl https://get.acme.sh | sh
    source ~/.bashrc
    ```
    > The installation script adds the `acme.sh` path to your `.bashrc` file. Running `source ~/.bashrc` makes it effective immediately in the current terminal. To ensure the command is available in all new terminals, it is recommended to log in again or open a new terminal window.
4.  Set the default CA to Let's Encrypt.
    ```bash
    acme.sh --set-default-ca --server letsencrypt
    ```
5.  Issue a wildcard certificate using the DNS challenge method. Replace `abc.org` with your own domain.
    ```bash
    acme.sh --issue --dns dns_azure -d '*.abc.org' -d 'abc.org'
    ```
    Upon success, you will see output similar to this:
    ```
    [Sun Dec 28 14: 33: 38 UTC 2025] Your cert is in: /home/user/.acme.sh/*.abc.org_ecc/*.abc.org.cer
    [Sun Dec 28 14:33:38 UTC 2025] Your cert key is in: /home/user/.acme.sh/*.abc.org_ecc/*.abc.org.key
    [Sun Dec 28 14:33:38 UTC 2025] The intermediate CA cert is in: /home/user/.acme.sh/*.abc.org_ecc/ca.cer
    [Sun Dec 28 14:33:38 UTC 2025] And the full-chain cert is in: /home/user/.acme.sh/*.abc.org_ecc/fullchain.cer
    ```

## 3. Configure Service and DNS

Using Hysteria2 as an example.

1.  **Install the Certificate**
    Create a directory and install the certificate obtained from `acme.sh` to the specified location. The `--reloadcmd` will restart the corresponding service after the certificate is automatically renewed.
    ```bash
    mkdir -p /etc/hysteria/
    acme.sh --install-cert -d '*.abc.org' \
        --key-file       /etc/hysteria/private.key  \
        --fullchain-file /etc/hysteria/cert.crt \
        --reloadcmd     "systemctl restart hysteria2"
    ```
    *The systemd service name `hysteria2` in `systemctl restart hysteria2` was configured in the previous article and depends on your local setup.

2.  **Configure the Service**
    Modify the service configuration file (e.g., Hysteria2's `config.yaml`) to point the certificate paths to `/etc/hysteria/cert.crt` and `/etc/hysteria/private.key`, then restart the service.

3.  **Configure DNS Records**
    In your domain provider's DNS settings page, add an `A` record for the server's IP, pointing to the subdomain assigned to this server.
    
    | Type | Name (Subdomain) | Content (Server IP) |
    | :--- | :--- | :--- |
    | A    | `us1`| `123.123.123.123`   |

## 4. Client Connection

After completing the steps above, modify the client configuration:
- **Server Address**: `us1.abc.org` (or the subdomain you set)
- **SNI/Server Name**: `us1.abc.org` (usually the same as the server address, clients will auto-fill this)
- **Allow Insecure**: `false`

The client should now be able to connect successfully.

## Summary

For each new server, simply repeat the steps in "[2. Issue the Certificate on the Server](#2-在服务器上申请证书)" and "[3. Configure Service and DNS](#3-配置服务与-dns)". `acme.sh` will automatically handle the certificate renewals.
