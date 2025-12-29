---
layout: post
title: Set up Hysteria2 Proxy with Self-Signed Certificate on Ubuntu
description: A guide to deploying Hysteria2 proxy on an Ubuntu server.
excerpt: This article provides detailed steps for installing and configuring Hysteria2 on Ubuntu, including installation, generating a self-signed certificate, configuring `config.yaml`, and setting up a systemd service for persistent background operation.
date: 2025-12-28
author: hxlh50k
header-img: null
catalog: true
tags:
    - Tools
    - Proxy
    - Hysteria2
    - Ubuntu
---

This article documents the complete process of deploying a Hysteria2 proxy on an Ubuntu server.

---
# Prerequisites

## 1. A Cloud Server

---
# Server-side Deployment

## 1. Install Hysteria2
Install with one click via the official script.
```bash
# Update package lists and install necessary tools
sudo apt update -y
sudo apt install curl wget sudo -y

# Download and execute the Hysteria2 installation script
wget -O hysteria-install.sh https://get.hy2.sh/
sudo bash hysteria-install.sh
```
After successful installation, the script will automatically create a configuration file and a `systemd` service. You will see output similar to the following:
```text
Congratulation! Hysteria 2 has been successfully installed on your server.

What's next?

        + Take a look at the differences between Hysteria 2 and Hysteria 1 at https://hysteria.network/docs/misc/2-vs-1/
        + Check out the quick server config guide at https://hysteria.network/docs/getting-started/Server/
        + Edit server config file at /etc/hysteria/config.yaml
        + Start your hysteria server with systemctl start hysteria-server.service
        + Configure hysteria start on system boot with systemctl enable hysteria-server.service
```

## 2. Configure Self-Signed Certificate
To encrypt communication, we need a TLS certificate. Here, we will generate a temporary self-signed certificate.
> The subsequent certificate information can be left blank or filled in arbitrarily; this certificate is only a placeholder.

```bash
sudo mkdir -p /etc/hysteria/certs
sudo openssl req -new -newkey rsa:2048 -nodes -x509 -days 365 \
  -keyout /etc/hysteria/certs/server.key \
  -out /etc/hysteria/certs/server.crt
```

## 3. Modify the Configuration File
Use the following command to write the configuration directly to `/etc/hysteria/config.yaml`.
> **Note:** Please replace `<your-port>` with the port you have allowed in your firewall, and replace `<your-password>` with a strong, secure password.
>
> It is recommended to use a UUID as the password, for example: `c3a7a8e4-3b9f-4d7e-8c1a-9b3d0f2e1c5d`

```bash
sudo bash -c 'cat > /etc/hysteria/config.yaml' <<EOF
listen: :<your-port>

tls:
  cert: /etc/hysteria/certs/server.crt
  key: /etc/hysteria/certs/server.key
  alpn:
    - h3
  sni: bing.com

auth:
  type: password
  password: <your-password>

masquerade:
  type: proxy
  proxy:
    url: https://www.bing.com/

transport:
  udp:
    hopInterval: 10s
EOF
```

## 4. Allow the Port in Your Cloud Provider's Firewall Settings

## 5. Set up the Systemd Service
To allow Hysteria2 to run in the background persistently and start on boot, we use `systemd` for management.
> **Note:** The path `/usr/local/bin/hysteria` in `ExecStart` is the default installation path for the official script. If your executable is in a different location, be sure to change it to the correct path.

```bash
# Create the systemd service file
sudo bash -c 'cat > /etc/systemd/system/hysteria2.service' <<EOF
[Unit]
Description=Hysteria2 Server
After=network.target

[Service]
ExecStart=/usr/local/bin/hysteria server -c /etc/hysteria/config.yaml
Restart=always
RestartSec=5
User=root
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd, enable start on boot, and start the service immediately
sudo systemctl daemon-reload && sudo systemctl enable hysteria2 && sudo systemctl start hysteria2
```

---
# Client Connection
On your client (e.g., Nekoray, v2rayN, etc.), fill in the following information based on the server's configuration:
- **Address**: `<your-ip>`
- **Port**: `<your-port>`
- **Password/Auth String**: `<your-password>`
- **SNI/Server Name**: `bing.com`
- **ALPN**: `h3`
- **Skip Certificate Verification/Allow Insecure**: `true`

After configuration, you should be able to connect to the server successfully.

**!!!DON'T FORGET TO CLOSE PORT 22 IN THE PORTAL FIREWALL!!!**

---
You can now use it as is, or follow the next article to configure a publicly trusted certificate.
You can also download the certificate you just generated and import it on the client (not recommended, as client support is limited; it's better to configure a public certificate directly).

---

# Appendix

## 1. Common Commands
```bash
# Check the status of the Hysteria2 service
sudo systemctl status hysteria2

# View the latest 20 log entries
sudo journalctl -u hysteria2 -n 20 --no-pager

# Start the service
sudo systemctl start hysteria2

# Stop the service
sudo systemctl stop hysteria2

# Restart the service
sudo systemctl restart hysteria2
```

---
