---
title: Configure Public Certificates for Multiple Servers with Azure DNS
description: Issue and renew a separate certificate for each Hysteria2 server using acme.sh, Azure DNS, and managed identities.
excerpt: A step-by-step guide to Azure DNS authorization, per-server public certificates, Hysteria2 certificate permissions, renewal checks, and migration from self-signed certificates.
date: '2025-12-28T16:00:00.000Z'
updated: 2026-09-26T00:00:00.000Z
author: hxlh50k
catalog: true
tags:
  - Tools
  - Proxy
  - Hysteria2
  - Ubuntu
  - acme.sh
  - SSL
  - Azure
  - Certificate
permalink: /2025/12/29/Configure-Public-Certificate-for-Multiple-Servers/
---

This guide replaces the self-signed certificate from [the Hysteria2 deployment guide](/2025/12/28/Setup-Hysteria2-Proxy-with-Self-Signed-Certificate-on-Ubuntu/) with a publicly trusted certificate.

**Each server gets its own certificate and private key**, for example `us1.example.com` and `jp2.example.com`. The original article requested the same wildcard names independently on every server; that produces separate certificates, not one shared certificate. Per-server names are simpler to manage and avoid putting a wildcard private key on every host.

## 1. Prerequisites

- A working Hysteria2 deployment using `hysteria-server.service` and the `hysteria` service account from the previous article.
- A public domain whose authoritative DNS is hosted in an **Azure public DNS Zone**. Configure the registrar's nameserver delegation first. Running a VM in Azure does not automatically make Azure your DNS provider.
- A stable public IPv4 address per server. This example uses `us1.example.com` and the documentation address `203.0.113.10`; replace both.
- Permission to manage the VM and DNS records. Assigning roles also requires `Microsoft.Authorization/roleAssignments/write` at the relevant scope, such as an appropriately scoped Role Based Access Control Administrator or Owner role. Contributor alone cannot assign roles.
- Outbound DNS and HTTPS access from the VM, including Azure Resource Manager and the ACME service, plus access to the local managed identity endpoint.

Two different terminals are used:

| Terminal | Purpose |
| :--- | :--- |
| **Azure Cloud Shell, Bash mode** | Manage the VM identity, role assignment, and DNS record. `az` is already available and signed in. |
| **SSH to the Ubuntu server, Bash** | Install acme.sh, request/install certificates, and manage Hysteria2. |

Do not paste the Bash blocks into Windows PowerShell. Stop on errors; do not proceed with empty IDs or a failed certificate request. Use a maintenance window for service restarts.

> **Existing installations:** Back up `/etc/hysteria` and your existing acme.sh account directory privately first. Complete the service-name migration in the previous article. Do not copy or print an old account configuration into chat or Git: it can contain secrets. Keep the old working certificate and renewal job until the new client connection is verified.

## 2. Prepare the DNS Record and VM Identity

### 2.1 Select Resources in Azure Cloud Shell

Run in **Cloud Shell Bash**, replacing every example value:

```bash
SUBSCRIPTION_ID='REPLACE_WITH_SUBSCRIPTION_ID'
VM_RG='REPLACE_WITH_VM_RESOURCE_GROUP'
VM_NAME='REPLACE_WITH_VM_NAME'
DNS_RG='REPLACE_WITH_DNS_RESOURCE_GROUP'
DNS_ZONE='example.com'
RECORD_NAME='us1'
SERVER_IPV4='203.0.113.10'

az account set --subscription "$SUBSCRIPTION_ID"
az account show --query '{name:name,id:id,tenantId:tenantId}' -o table

ZONE_ID="$(az network dns zone show \
  --resource-group "$DNS_RG" --name "$DNS_ZONE" --query id -o tsv)"
: "${ZONE_ID:?DNS zone lookup failed}"
az network dns zone show --resource-group "$DNS_RG" --name "$DNS_ZONE" \
  --query nameServers -o tsv
```

Confirm the subscription and zone, and check that the nameservers match your registrar's delegation. These Cloud Shell examples assume the VM and DNS Zone are in the same subscription.

### 2.2 Create the Server's A Record

For a **new, unused** record name:

```bash
az network dns record-set a add-record \
  --resource-group "$DNS_RG" --zone-name "$DNS_ZONE" \
  --record-set-name "$RECORD_NAME" --ipv4-address "$SERVER_IPV4"

az network dns record-set a show \
  --resource-group "$DNS_RG" --zone-name "$DNS_ZONE" \
  --name "$RECORD_NAME" --query aRecords -o table
```

If the name already exists, inspect and update its record set deliberately instead of appending another IP: multiple A records can send clients to the wrong server. Do not publish an AAAA record unless IPv6 works end to end. DNS must lead directly to your server, not a conventional HTTP/CDN proxy.

### 2.3 Preferred: Use the Azure VM's System-Assigned Managed Identity

Still in **Cloud Shell Bash**:

```bash
az vm identity assign \
  --resource-group "$VM_RG" --name "$VM_NAME" --output none
PRINCIPAL_ID="$(az vm show \
  --resource-group "$VM_RG" --name "$VM_NAME" --query identity.principalId -o tsv)"
: "${PRINCIPAL_ID:?VM identity assignment failed}"

az role assignment create \
  --assignee-object-id "$PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "DNS Zone Contributor" \
  --scope "$ZONE_ID"

az role assignment list --scope "$ZONE_ID" --all \
  --query "[?principalId=='$PRINCIPAL_ID'].{role:roleDefinitionName,scope:scope}" \
  -o table
```

Confirm the assignment targets **this DNS Zone**, not the whole subscription. If it already exists, verify it rather than repeatedly creating it. Role changes may take several minutes to propagate.

This avoids a long-lived application secret on the VM. The DNS role still permits changes throughout the zone; it is not restricted to this host's challenge record. For stronger isolation, use a dedicated validation zone/delegation and narrower permissions as a separate design.

On the **Ubuntu VM**, start a root Bash session and keep it open for the remaining server steps:

```bash
sudo -i
umask 077
export AZUREDNS_SUBSCRIPTIONID='REPLACE_WITH_DNS_ZONE_SUBSCRIPTION_ID'
export AZUREDNS_MANAGEDIDENTITY=true
```

The subscription ID identifies the subscription containing the DNS Zone. The plugin obtains an access token from the VM's managed identity endpoint; **Azure CLI is not needed on the VM for renewal**. This flow assumes a system-assigned identity, not an arbitrary user-assigned identity.

### 2.4 Alternative: A Service Principal for Non-Azure Servers

**Skip this section if you used managed identity.** Choose exactly one authentication method per server.

In **Cloud Shell Bash**, with `ZONE_ID` from section 2.1:

```bash
az ad sp create-for-rbac \
  --name "AcmeDNS-us1" \
  --role "DNS Zone Contributor" \
  --scopes "$ZONE_ID"
```

Store the returned `appId`, `tenant`, and `password` privately. This requires permission to create the application/service principal as well as assign the role. Plan secret rotation before its expiry.

On the **Ubuntu server**, enter `sudo -i`, run `umask 077`, and then:

```bash
export AZUREDNS_SUBSCRIPTIONID='REPLACE_WITH_DNS_ZONE_SUBSCRIPTION_ID'
export AZUREDNS_MANAGEDIDENTITY=false
export AZUREDNS_TENANTID='REPLACE_WITH_TENANT_ID'
export AZUREDNS_APPID='REPLACE_WITH_APP_ID'
read -r -s -p 'Azure client secret: ' AZUREDNS_CLIENTSECRET
printf '\n'
export AZUREDNS_CLIENTSECRET
```

The hidden prompt avoids putting the literal secret in shell history. acme.sh saves reusable credentials in its account configuration; **this is not an encrypted secret store**. Managed identity can also involve cached access tokens, so protect the acme.sh directory in either mode. Never share it or add it to source control.

## 3. Install acme.sh and Request the Certificate

Run in the **same root Bash session on the server** where you selected DNS authentication:

```bash
DOMAIN='us1.example.com'
ACME_EMAIL='REPLACE_WITH_YOUR_EMAIL'

apt update
apt install -y curl ca-certificates openssl cron dnsutils nano less
systemctl enable --now cron

curl -fsSL https://get.acme.sh -o /root/acme-install.sh
less /root/acme-install.sh
sh /root/acme-install.sh "email=$ACME_EMAIL"

/root/.acme.sh/acme.sh --version
/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt
chmod 700 /root/.acme.sh

dig +short NS example.com
dig +short A "$DOMAIN"
```

Inspect the installer before running it. Use the absolute acme.sh path: no shell alias or `source ~/.bashrc` is required. Root is chosen here so the renewal job can deploy keys and restart the service; **Hysteria itself still runs as `hysteria`**.

Confirm the DNS results match your zone delegation and server IP. Replace `example.com` in the `dig` command with your actual zone.

The following staging/production sequence is for a **new certificate entry**. Before using it, inspect `/root/.acme.sh/acme.sh --list`. If this exact domain is already managed with a production deployment hook, do not run staging against that entry: an existing hook may deploy the staging certificate. Reuse the valid production certificate and proceed to section 4 instead, or use the normal production renewal process if renewal is due.

For a new entry, first test DNS authorization against Let's Encrypt **staging**:

```bash
/root/.acme.sh/acme.sh --issue \
  --server letsencrypt_test --dns dns_azure \
  -d "$DOMAIN" --keylength ec-256
```

A staging certificate is not trusted by clients. Do not install it into Hysteria. If validation fails, check delegation, role scope/propagation, managed identity, DNS access, and any CAA restrictions before retrying.

After staging succeeds, request the production certificate:

```bash
/root/.acme.sh/acme.sh --issue \
  --server letsencrypt --dns dns_azure \
  -d "$DOMAIN" --keylength ec-256 --force
```

Here `--force` is used **once** to replace the fresh staging certificate for the same name. Do not put it in cron or repeatedly force production requests; CA rate limits apply. On later renewals, use the normal renewal job.

Verify the production request succeeded before continuing:

```bash
/root/.acme.sh/acme.sh --info -d "$DOMAIN" --ecc
chmod 600 /root/.acme.sh/account.conf
unset AZUREDNS_CLIENTSECRET
```

The saved CA should be the production Let's Encrypt endpoint, not its staging endpoint. acme.sh persists the DNS authentication settings for renewal; you do not need to log in interactively each time.

## 4. Install the Certificate with Service-Readable Permissions

Still in **root Bash on the server**. Create the configuration backup only on the first migration attempt; retain it if you retry, rather than overwriting the last known-working copy.

```bash
systemctl is-active hysteria-server.service
cp -a /etc/hysteria/config.yaml /etc/hysteria/config.yaml.before-public-cert
install -d -o root -g hysteria -m 750 /etc/hysteria/certs

touch /etc/hysteria/certs/public.key /etc/hysteria/certs/public.crt
chown root:hysteria /etc/hysteria/certs/public.key /etc/hysteria/certs/public.crt
chmod 640 /etc/hysteria/certs/public.key
chmod 644 /etc/hysteria/certs/public.crt

/root/.acme.sh/acme.sh --install-cert -d "$DOMAIN" --ecc \
  --key-file /etc/hysteria/certs/public.key \
  --fullchain-file /etc/hysteria/certs/public.crt \
  --reloadcmd "systemctl restart hysteria-server.service"

sudo -u hysteria test -r /etc/hysteria/certs/public.key
sudo -u hysteria test -r /etc/hysteria/certs/public.crt
openssl x509 -in /etc/hysteria/certs/public.crt \
  -noout -subject -issuer -dates -ext subjectAltName
```

Stop if any command fails. Confirm the certificate contains your domain, is current, and is not a staging certificate. Pre-created files retain their ownership and permissions when acme.sh installs renewed certificates. `public.crt` contains the **full chain**, not just the leaf certificate.

Do not point Hysteria directly into `/root/.acme.sh`, and do not make `/root` readable by the service account. Always use `--install-cert` so acme.sh remembers the deployment paths and hook.

The install command runs the restart hook immediately and saves it for renewal. On this first run the service still uses its old certificate, which is intentional. This simple hook briefly disconnects clients; it is not a zero-downtime deployment mechanism.

### Switch Hysteria to the New Paths

Edit `/etc/hysteria/config.yaml` on the server:

```bash
nano /etc/hysteria/config.yaml
```

Replace only the existing `tls` section, keeping `listen`, `auth`, and other intentional settings:

```yaml
tls:
  cert: /etc/hysteria/certs/public.crt
  key: /etc/hysteria/certs/public.key
```

Do not also enable Hysteria's built-in `acme` configuration. This guide uses acme.sh as the single certificate manager.

```bash
systemctl restart hysteria-server.service
systemctl status hysteria-server.service --no-pager
journalctl -u hysteria-server.service -n 50 --no-pager
```

If the change fails, inspect the journal, restore the saved configuration, restart, and reconnect with the old client settings:

```bash
cp -a /etc/hysteria/config.yaml.before-public-cert /etc/hysteria/config.yaml
systemctl reset-failed hysteria-server.service
systemctl restart hysteria-server.service
```

Keep the old certificate files until the new connection has been verified.

## 5. Update and Verify the Client

For the official client, retain your password and local proxy settings, and replace the connection/TLS settings:

```yaml
server: us1.example.com:443
auth: "YOUR_EXISTING_PASSWORD"

tls:
  sni: us1.example.com
  insecure: false

socks5:
  listen: 127.0.0.1:1080
```

**Remove the old `pinSHA256` and any self-signed `ca` override.** Pinning the old certificate will break this migration; pinning a routinely renewed leaf certificate will break future renewal.

For GUI clients, set server address and SNI to your subdomain, retain the UDP port and password, and disable "Allow Insecure / Skip Certificate Verification". Field names vary by client core.

Restart the client and test from the client computer:

```bash
curl --proxy socks5h://127.0.0.1:1080 --max-time 30 https://example.com/
```

Use `curl.exe` in Windows PowerShell. A successful proxied request with certificate verification enabled confirms more than merely inspecting a certificate on disk. A normal TCP `openssl s_client -connect host:443` test does **not** test this UDP/QUIC service.

## 6. Check Renewal and Keep Logs

On the server in **root Bash**:

```bash
crontab -l
systemctl status cron --no-pager
/root/.acme.sh/acme.sh --info -d "$DOMAIN" --ecc
```

The installer should have created one daily acme.sh cron entry. Use `crontab -e` to replace **only that entry**, preserving unrelated jobs. For example:

```cron
17 3 * * * /root/.acme.sh/acme.sh --cron --home /root/.acme.sh >> /var/log/acme-renew.log 2>&1
```

This runs at 03:17 in the server's time zone; check `timedatectl`. It checks certificates daily but only renews when needed. Do not add a second renewal job, `--force`, or a separate daily Hysteria restart.

Create the log with restricted permissions and check the scheduled command once:

```bash
touch /var/log/acme-renew.log
chmod 600 /var/log/acme-renew.log
/root/.acme.sh/acme.sh --cron --home /root/.acme.sh
openssl x509 -in /etc/hysteria/certs/public.crt -noout -enddate
openssl x509 -in /etc/hysteria/certs/public.crt -noout -checkend 1209600
```

The final command returns nonzero if the certificate expires within 14 days. A fresh certificate normally causes the cron check to **skip renewal**; that does not prove an actual renewal has happened. The initial staging request tested DNS validation, and the initial installation/client test exercised deployment. Inspect the log and retest the client after the first real renewal. Rotate the log as part of normal server maintenance.

Configure an external monitor or your monitoring system to alert on certificate expiry, renewal errors, and failed client connections. Merely writing a log does not notify you. Monitor the installed certificate as well as the service; a successful CA request can still be followed by a failed deployment hook.

### Migrating an Existing Wildcard Renewal

Only after the new certificate and client connection work, list the certificates managed by the old acme.sh installation:

```bash
/root/.acme.sh/acme.sh --list
```

If an old wildcard certificate is no longer used by **any** service on this machine, remove it from automatic renewal using its actual main domain and key type. For example, for an ECC wildcard certificate:

```bash
/root/.acme.sh/acme.sh --remove -d '*.example.com' --ecc
```

This removes the renewal entry; it does not revoke the certificate or delete the files. Check other users' cron jobs if the old installation ran under another account. Do not leave an obsolete renewal hook that restarts `hysteria2.service`. After all consumers migrate to managed identity, revoke the old service principal credentials/role assignments rather than leaving subscription-wide access in place.

## 7. Add Another Server

Repeat the steps with that server's VM, IP, record name, and `DOMAIN`, for example `jp2.example.com`. Give it its own managed identity and private key. Do not copy the first server's acme.sh account directory or a long-lived secret to every host.

A wildcard can still be appropriate when one endpoint genuinely needs many names. However, `*.example.com` does not cover the apex or deeper names such as `a.b.example.com`. Central issuance and secure distribution is a different design with its own key-management and deployment requirements; it is not implemented by independently requesting a wildcard on every server.

If disconnections continue, use the [first article's troubleshooting checklist](/2025/12/28/Setup-Hysteria2-Proxy-with-Self-Signed-Certificate-on-Ubuntu/#8-Diagnose-Intermittent-Disconnections). A trusted certificate improves identity verification, but it cannot repair packet loss, UDP filtering, CPU throttling, or client congestion settings.

### References

- [acme.sh installation and certificate deployment](https://github.com/acmesh-official/acme.sh)
- [Azure DNS plugin and managed identity support](https://github.com/acmesh-official/acme.sh/blob/master/dnsapi/dns_azure.sh)
- [Azure VM managed identities](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-configure-managed-identities)
- [Let's Encrypt rate limits](https://letsencrypt.org/docs/rate-limits/)
