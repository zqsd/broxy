# Introduction
Broxy is a binding proxy. It forwards your requests, but uses a source ip from an ip block routed to your machine.

# Setup
One easy way is to use a SystemD service.

Create `/etc/systemd/system/broxy.service` :
```
[Unit]
Description=broxy
After=network.target

[Service]
WorkingDirectory=/home/youruser/broxy
EnvironmentFile=/home/youruser/.env
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=500ms
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nodejs
User=youruser
Group=youruser

[Install]
WantedBy=multi-user.target
```

And `/home/youruser/broxy/.env` :
```
LISTEN=127.0.0.1 or 0.0.0.0 for open
PORT=80
PASSWORD=randompassword
ADDRESS=192.168.1.0/24
```


# Usage
The curl command `curl --proxy http://username:randompassword@127.0.0.1:8080 http://ifconfig.me` will give a random ip for any different username, but to make sessions work it will always be the same ip for the same username.

# Linux ipv6 setup
Some providers gives you an IPv6 block. This gives many ip for cheap, but it's harder to configure and will depend on your provider.  

First you should allow non local binding on your system so broxy can bind to an ip not added on your system : `net.ipv6.ip_nonlocal_bind=1` to `/etc/sysctl.conf` (and to avoid rebooting run once `sysctl net.ipv6.ip_nonlocal_bind=1`).

To make tell the router you are using those the ips you are binding to, install ndppd and create `/etc/ndppd.conf` :

```route-ttl 30000
proxy eth0 {
    router no
    timeout 500
    ttl 30000
    rule 2001:1337:1337:1337::/64 {
        static
    }
}
```

And now just add the ipv6 block. For `/etc/network/interfaces` :
```
iface eth0 inet6 static
    address 2001:1337:1337:1337::1/64
    gateway 2001:1337:1337:1337::
    post-up ip route add local 2001:1337:1337:1337::/64 dev eth0
```