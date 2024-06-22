<script lang="ts">
    import {onMount} from 'svelte';
    import * as CryptoJS from 'crypto-js';
    import pkg from 'elliptic';
    const {ec} = pkg;
    import { page } from '$app/stores';

    $: urlParams = $page.url.searchParams;
    $: baseUrl = $page.url.protocol + '//' + $page.url.host;
    $: public1 = urlParams.get('public1')?.toString();
    $: public2 = urlParams.get('public2')?.toString();
    $: encryptedMessage = urlParams.get('mask')?.toString();
    $: sessionId = urlParams.get('session')?.toString();

    enum statusEnum {
        start = "状态：开始",
        accept = "状态：接受邀请",
        chat = "状态：聊天中",
        error = "状态：错误"
    }

    enum infoEnum {
        start = "会话邀请已创建，已自动复制，直接到聊天粘贴",
        accept = "已接受邀请，已自动复制，直接到聊天粘贴",
        chat = "已自动复制，直接到聊天粘贴",
        error = "重启加密会话"
    }

    let shared: string = ""
    let start: string = ""
    let session: string = ""
    let status:string = "";
    let mask:string = "";
    let info:string = "";
    let raw: string = ""
    let receive: string = ""

    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text)

    const startSession = () => {
        const newSessionId = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
        // generate an elliptic curve25519 key pair
        const curve = new ec('curve25519');
        const key = curve.genKeyPair();
        const publicKeyStr = key.getPublic().encode('hex', true);
        const privateKeyStr = key.getPrivate().toString('hex');
        localStorage.setItem(newSessionId, JSON.stringify({ privateKey1: privateKeyStr }));
        const inviteUrl = `打开加密聊天通道 ${baseUrl}/?session=${encodeURIComponent(newSessionId)}&public1=${encodeURIComponent(publicKeyStr)}`;
        copyToClipboard(inviteUrl);
        info = infoEnum.start;
    }

    const acceptInvitation = () => {
        if (!sessionId) return;
        //generate an elliptic curve25519 key pair for key exchange
        const curve = new ec('curve25519');
        const key2 = curve.genKeyPair();
        const publicKey2 = key2.getPublic().encode('hex', true);
        const acceptanceUrl = `${baseUrl}/?session=${encodeURIComponent(sessionId)}&public2=${encodeURIComponent(publicKey2)}`;
        mask = acceptanceUrl;
        copyToClipboard(acceptanceUrl);
        info=infoEnum.accept;
    }

    function doEncrypt() {
        if (!sessionId) return;
        const encrypt = CryptoJS.AES.encrypt(raw, shared).toString();
        const maskURL = `${baseUrl}/?session=${encodeURIComponent(sessionId)}&mask=${encodeURIComponent(encrypt)}`;
        mask = maskURL;
        copyToClipboard(maskURL);
        info=infoEnum.chat;
    }

    onMount(() => {
        // fresh page no nothing
        if (!sessionId) {
            status="状态：开始";
            start="开始加密会话";
            return;
        }
        // accept invitation when public1 is not empty and public2 is empty
        if (public1 && !public2) {
            const cache = localStorage.getItem(sessionId);
            if (!cache) return;
            const sessionItem = JSON.parse(cache);
            if (sessionItem) {
                status = statusEnum.error;
                start = "重启加密会话";
                return;
            }
        }
        // in a chat session
        if (!encryptedMessage) {
            console.error("no encrypted message");
            return;
        }
        const cache = localStorage.getItem(sessionId);
        if (!cache) return;
        const session = JSON.parse(cache);
        const sharedKey = session?.shared;
        status=statusEnum.chat;
        const decryptedMessage = CryptoJS.AES.decrypt(encryptedMessage, sharedKey);
        receive=decryptedMessage.toString(CryptoJS.enc.Utf8);
    });
</script>

<div>
    <div id="session"></div>
    <div id="setup">
        <button id="start" on:click={startSession}>{start}</button>
    </div>
    <div id="exchange" style="display: none;">
        <button id="accept" on:click={acceptInvitation}>接受邀请</button>
    </div>
    <div id="chat" style="display: none;">
        <div id="receiveTitle">接受到的信息：</div>
        <div id="receive">{receive}</div>
        <textarea bind:value={raw} placeholder="输入需要加密的信息"></textarea>
        <button id="doEncrypt" on:click={doEncrypt}>加密并生成链接</button>
    </div>
    <div id="status">{status}</div>
    <div id="mask">{mask}</div>
    <div id="info">{info}</div>
</div>