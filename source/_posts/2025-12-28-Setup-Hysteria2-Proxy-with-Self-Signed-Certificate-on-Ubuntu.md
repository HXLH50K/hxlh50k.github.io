---
layout: post
title: Set up Hysteria2 Proxy with Self-Signed Certificate on Ubuntu
description: Deploy Hysteria2 on Ubuntu with certificate pinning, one systemd service, and a practical troubleshooting checklist.
excerpt: A step-by-step Hysteria2 deployment guide covering a self-signed certificate with fingerprint verification, UDP firewall rules, service permissions, client testing, and intermittent disconnection diagnostics.
date: 2025-12-28
updated: 2026-09-26
author: hxlh50k
header-img: null
catalog: true
tags:
    - Tools
    - Proxy
    - Hysteria2
    - Ubuntu
---

This guide sets up a single-port Hysteria2 server with a self-signed certificate and **client-side certificate fingerprint verification**. It does not require a domain. For everyday use with GUI clients, continue with [public certificates for multiple servers](/2025/12/29/Configure-Public-Certificate-for-Multiple-Servers/).

## 1. Prerequisites and Conventions

- An Ubuntu 22.04 or 24.04 LTS server with a stable public IPv4 address, outbound Internet access, and a sudo-capable SSH account.
- An SSH key and a working recovery method. On Azure, test Run Command or another management channel before restricting SSH.
- A Hysteria2-compatible client. The YAML examples below use the **official Hysteria2 client**, not sing-box or Mihomo configuration syntax.
- This guide uses **UDP 443**, `/etc/hysteria/config.yaml`, and **`hysteria-server.service`** throughout. If you choose another port, change it in the server, both firewalls, and client.

Run server commands in **Bash on Ubuntu**, not in Windows PowerShell. Run each block in order, inspect its output, and stop if a command fails. Replace example IP addresses before use.

### Existing Installations: Read This First

The original version of this article created a second service named `hysteria2.service`. Do not run it alongside the official service.

Before changing an existing installation:

```bash
sudo cp -a /etc/hysteria "/root/hysteria-backup-$(date +%Y%m%d-%H%M%S)"
sudo systemctl list-unit-files 'hysteria*'
sudo systemctl cat hysteria-server.service
```

If `hysteria2.service` exists, stop and disable it during a maintenance window:

```bash
sudo systemctl disable --now hysteria2.service
```

This interrupts its connections. Keep the old unit and backup until the replacement works. Preserve your current password and certificate; **skip the generation commands below unless you intentionally want to rotate them**. When switching from root to the `hysteria` user, grant that user read access to the actual certificate paths, including parent directories. Update any certificate renewal hook to restart `hysteria-server.service`, not `hysteria2`.

## 2. Install the Official Service

```bash
sudo apt update
sudo apt install -y curl ca-certificates openssl ufw less

curl -fsSL https://get.hy2.sh/ -o hysteria-install.sh
less hysteria-install.sh
sudo env HYSTERIA_USER=hysteria bash hysteria-install.sh

/usr/local/bin/hysteria version
sudo systemctl cat hysteria-server.service
id hysteria
```

Inspect the downloaded script before running it as root. The installer creates the service account, service, and a sample configuration; it does not complete this deployment for you. Record the installed version. For repeatable deployments, the official installer also accepts `--version` followed by your tested release tag.

Confirm the unit uses `User=hysteria` and `Group=hysteria`. Do not create another service or overwrite the vendor unit. Keep the configuration and certificate backups when upgrading; an installer upgrade can restart a running official service.

## 3. Create a Self-Signed Certificate

For a **new installation**, generate a certificate with an explicit name. `hy.example.invalid` is a local TLS identity here, not a domain you need to register or resolve.

```bash
sudo install -d -o root -g hysteria -m 750 /etc/hysteria/certs
sudo openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
  -subj "/CN=hy.example.invalid" \
  -addext "subjectAltName=DNS:hy.example.invalid" \
  -keyout /etc/hysteria/certs/server.key \
  -out /etc/hysteria/certs/server.crt

sudo chown root:hysteria /etc/hysteria/certs/server.key /etc/hysteria/certs/server.crt
sudo chmod 640 /etc/hysteria/certs/server.key
sudo chmod 644 /etc/hysteria/certs/server.crt

sudo -u hysteria test -r /etc/hysteria/certs/server.key
sudo -u hysteria test -r /etc/hysteria/certs/server.crt
sudo openssl x509 -in /etc/hysteria/certs/server.crt \
  -noout -dates -fingerprint -sha256
```

The two `test` commands succeed silently; a nonzero exit status means permissions must be fixed before proceeding. Save the SHA-256 fingerprint through your trusted SSH session. Never distribute the private key.

This certificate is not renewed automatically. Set an expiry reminder. Replacing it changes its fingerprint, so plan to update every pinned client, or move to the public-certificate guide before expiry.

## 4. Write the Server Configuration

For a new installation, generate a password in the same Bash session used to write the configuration:

```bash
HY_PASSWORD="$(openssl rand -hex 32)"
printf 'Save this password privately: %s\n' "$HY_PASSWORD"
```

For an existing installation, instead use `sudoedit /etc/hysteria/config.yaml` and retain the current password, certificate paths, and any intentional settings. Remove the obsolete server-side `tls.sni`, `tls.alpn`, and `transport.udp.hopInterval` entries from the old article. Retain the existing client SNI if you retain its certificate; the `hy.example.invalid` example below is for the newly generated certificate.

The following block **replaces** the sample configuration for a new installation:

```bash
: "${HY_PASSWORD:?Generate the password in this shell first}"
sudo chown root:hysteria /etc/hysteria/config.yaml
sudo chmod 640 /etc/hysteria/config.yaml
sudo tee /etc/hysteria/config.yaml > /dev/null <<EOF
listen: 0.0.0.0:443

tls:
  cert: /etc/hysteria/certs/server.crt
  key: /etc/hysteria/certs/server.key

auth:
  type: password
  password: "$HY_PASSWORD"
EOF
unset HY_PASSWORD
```

The server is deliberately IPv4-only to match this guide. No third-party masquerade website is needed for basic operation; unauthenticated HTTP requests receive the default 404 response. Add optional features only after the baseline works.

## 5. Allow UDP and Preserve Management Access

### Azure Network Security Group

In the VM's **Networking / Network settings**, inspect the NSGs attached to both the NIC and subnet. Where an NSG is attached, its effective rules must allow the traffic.

Create an inbound allow rule for:

| Setting | Value |
| :--- | :--- |
| Source | Your client IP ranges, or Any if clients roam |
| Source port ranges | `*` |
| Destination | The VM |
| Destination port | `443` |
| Protocol | **UDP** |
| Action | Allow |
| Priority | An unused priority ahead of matching deny rules, for example `300` |

Keep a separate **TCP 22** allow rule restricted to your administration public IP/CIDR. TCP 443 is not a substitute for UDP 443.

### Ubuntu Firewall

If another firewall manager is already in use, configure that manager instead of enabling UFW on top of it. Otherwise, replace the example below with **your administrator computer's public IPv4 address**, not the server's:

```bash
ADMIN_CIDR='198.51.100.20/32'
sudo ufw status verbose
sudo ufw allow from "$ADMIN_CIDR" to any port 22 proto tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status verbose
```

Before enabling UFW, also allow any other services you need and confirm outbound traffic remains allowed. Keep the current SSH session open and test a **second SSH connection** before removing older broad SSH rules. Update the allowlist when your management IP changes; do not blindly close port 22.

## 6. Start and Verify the Service

Add restart handling with a drop-in rather than a second service:

```bash
sudo install -d -m 755 /etc/systemd/system/hysteria-server.service.d
sudo tee /etc/systemd/system/hysteria-server.service.d/restart.conf > /dev/null <<'EOF'
[Unit]
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Restart=on-failure
RestartSec=5
LimitNOFILE=65536
EOF

sudo systemctl daemon-reload
sudo systemctl enable hysteria-server.service
sudo systemctl restart hysteria-server.service
sudo systemctl status hysteria-server.service --no-pager
sudo journalctl -u hysteria-server.service -n 50 --no-pager
sudo ss -lunp 'sport = :443'
```

The service should be `active (running)`, the journal should report successful startup, and the socket listing should show Hysteria on UDP 443. `restart` starts an inactive service and also applies configuration changes if it was already running.

If startup fails, read the journal first. Common causes are unreadable keys, malformed YAML, and another process holding the port. After fixing a repeated-start failure:

```bash
sudo systemctl reset-failed hysteria-server.service
sudo systemctl start hysteria-server.service
```

Automatic restart handles process failure, **not** a stalled network path. Do not add a scheduled restart as a substitute for diagnosis.

## 7. Connect and Test from the Client

On your **client computer**, install the official Hysteria2 executable from the [official installation page](https://v2.hysteria.network/docs/getting-started/Installation/). Create a private `client.yaml` with the following content. Replace the IP, password, and fingerprint; use just the colon-separated fingerprint after `sha256 Fingerprint=`, not that label.

```yaml
server: 203.0.113.10:443
auth: "REPLACE_WITH_YOUR_PASSWORD"

tls:
  sni: hy.example.invalid
  insecure: true
  pinSHA256: "REPLACE_WITH_CERTIFICATE_SHA256_FINGERPRINT"

socks5:
  listen: 127.0.0.1:1080
```

Here, `insecure: true` bypasses public-CA verification of the self-signed certificate, while **`pinSHA256` still verifies the server certificate**. Never use this example without the pin. A GUI may not expose certificate pinning or may use different field names; if it cannot verify this certificate securely, use the public-certificate guide instead.

On a Linux/macOS client:

```bash
hysteria client -c client.yaml
```

On a Windows client with the executable named `hysteria.exe` in the current directory:

```powershell
.\hysteria.exe client -c .\client.yaml
```

Keep the client running. In another terminal, test a real request through it:

```bash
curl --proxy socks5h://127.0.0.1:1080 --max-time 30 https://example.com/
```

In Windows PowerShell, use `curl.exe` instead of `curl`. Success means receiving the expected page **through the proxy**, not just seeing a server process. Also test with a deliberately wrong fingerprint in a temporary client configuration: it must fail when making a request. Stop the first client before testing another on port 1080, then restore the correct configuration.

Start without a forced client bandwidth value. Excessive bandwidth settings can cause congestion and disconnections. The official client normally sends keepalives already; adding the default keepalive value is not a proven fix.

## 8. Diagnose Intermittent Disconnections

Record the failure time, time zone, client/core version, network type, and whether another client or mobile hotspot also fails. **Collect evidence during the failure before restarting anything.**

On the server:

```bash
date -Is
uptime
free -h
/usr/local/bin/hysteria version
sudo systemctl show hysteria-server.service \
  -p ActiveState -p SubState -p NRestarts -p ExecMainStartTimestamp
sudo journalctl -u hysteria-server.service --since "30 minutes ago" \
  --no-pager -o short-iso
sudo journalctl -k --since "30 minutes ago" --no-pager
sudo ss -lunp 'sport = :443'
```

Save client logs for the same period and redact passwords, tokens, and subscription URLs before sharing them.

| Observation | Next check |
| :--- | :--- |
| The process restarted or the VM uptime reset | Look for process errors, out-of-memory kills, updates, reboots, and Azure Resource Health events. |
| Only heavy transfers fail | Compare CPU/memory and actual bandwidth with client settings. On Azure B-series, correlate `CPU Credits Remaining` with the failure; exhausted credits reduce CPU performance. |
| SSH works and Hysteria stays running, but handshakes time out | Compare another client/network; investigate the UDP path, local router/NAT, and effective firewall rules. Working SSH alone does not prove UDP works. |
| The tunnel connects but websites do not load | Check server DNS resolution and outbound connectivity, for example `getent ahostsv4 example.com` and `curl -I --max-time 15 https://example.com/`. |
| Logs show certificate errors | Check server/client clocks, certificate expiry, SNI, and the pinned fingerprint. Certificate problems normally do not repeatedly disappear after a few minutes without another change. |

Ping, a TCP port check, or `nc -u` alone does not prove a Hysteria handshake succeeds.

### Port Hopping Is an Optional Experiment, Not a Default Fix

`transport.udp.hopInterval` is a **client** option, and it only matters when the client uses a multi-port server address. It does not enable hopping when added to the server YAML.

Only try hopping after the single-port setup works. Follow the [official port-hopping guide](https://v2.hysteria.network/docs/advanced/Port-Hopping/) for your installed version: the server must accept/forward every advertised UDP port, both firewalls must allow the range, and the client core must support it. Built-in server range forwarding on supported Linux versions also needs firewall tooling and appropriate capabilities. Hopping cannot fix a restriction affecting all UDP traffic.

Change one setting at a time and repeat the same idle/reconnect and sustained-transfer tests. Do not blindly enlarge QUIC windows, disable MTU discovery, or raise timeouts.

## 9. Maintenance and Next Steps

```bash
sudo systemctl status hysteria-server.service --no-pager
sudo journalctl -u hysteria-server.service -n 100 --no-pager
sudo systemctl restart hysteria-server.service
sudo openssl x509 -in /etc/hysteria/certs/server.crt -noout -enddate
```

Restarting disconnects active clients. Keep backups, schedule upgrades, and verify a real client connection after each change. Do not commit passwords, client configurations, or private keys.

Next: [Configure Public Certificates for Multiple Servers](/2025/12/29/Configure-Public-Certificate-for-Multiple-Servers/).

### References

- [Official server installation script](https://v2.hysteria.network/docs/getting-started/Server-Installation-Script/)
- [Full server configuration](https://v2.hysteria.network/docs/advanced/Full-Server-Config/)
- [Full client configuration](https://v2.hysteria.network/docs/advanced/Full-Client-Config/)
- [Azure B-series CPU credits](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/b-series-cpu-credit-model)
