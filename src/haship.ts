import ipaddr from 'ipaddr.js';
import md5 from 'md5';

export function getFamily(cidr: string) {
    const [address, mask] = ipaddr.parseCIDR(cidr);
    if(address instanceof ipaddr.IPv4) {
        return 4;
    }
    else if(address instanceof ipaddr.IPv6) {
        return 6;
    }
    else {
        throw new Error('unrecognized IP');
    }
}

export function mergeIP(ipA: number[], ipB: number[], mask: number): number[] {
    if(ipA.length !== ipB.length) {
        throw new Error('invalid array sizes');
    }

    const merged = new Array(ipA.length);
    const start = Math.floor(mask / 8);

    for(let i = 0; i < start; i++) {
        merged[i] = ipA[i];
    }

    const byteMask = 8 - (mask - start * 8);
    merged[start] = 0;
    for(let i = 0; i < 8; i++) {
        merged[start] |= i < byteMask ? ipB[i] & (1 << i) : ipA[i] & (1 << i);
    }
    
    for(let i = start + 1; i < ipA.length; i++) {
        merged[i] = ipB[i];
    }
    return merged;
}

export function hashIPv6(cidr: string, key: string) : string {
    const [ip, mask] = ipaddr.parseCIDR(cidr);

    const ipA = ip.toByteArray(),
          ipB = md5(key, {asBytes: true});
    const merged = mergeIP(ipA, ipB, mask);
    return ipaddr.fromByteArray(merged).toNormalizedString();
}