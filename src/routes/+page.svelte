<script lang="ts">
    import pkg from 'elliptic';
    import {onMount} from 'svelte';
    import {page} from '$app/stores';
    import {decrypt, encrypt} from "./utils";

    const {ec} = pkg;

    const ENCRYPTED_MESSAGE = 'encryptedMessage';
    $: urlParams = $page.url.searchParams;
    $: baseUrl = $page.url.protocol + '//' + $page.url.host;
    $: public1 = urlParams.get('public1')?.toString();
    $: public2 = urlParams.get('public2')?.toString();
    $: encryptedMessage = urlParams.get(ENCRYPTED_MESSAGE)?.toString();
    $: sessionId = urlParams.get('session')?.toString();

    enum statusEnum {
        start = "状态：开始",
        accept = "状态：接受邀请",
        chat = "状态：聊天中",
        error = "状态：错误"
    }

    enum actionsEnum {
        start = "开始加密会话",
        accept = "接受邀请",
        chat = "加密并生成链接",
        restart = "重启加密会话"
    }

    enum infoEnum {
        start = "会话邀请已创建，已自动复制，直接到聊天粘贴",
        accept = "已接受邀请，已自动复制，直接到聊天粘贴",
        chat = "已自动复制，直接到聊天粘贴",
        error = "重启加密会话"
    }

    let shared: string = "";
    let start: string = "";
    let status:string = "";
    let displayUrl:string = "";
    let info:string = "";
    let raw: string = ""
    let receive: string = ""
    const curve = new ec('curve25519');

    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text)

    const startSession = () => {
        const newSessionId = window.crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
        // generate an elliptic curve25519 key pair
        const key = curve.genKeyPair();
        const publicKeyStr = key.getPublic().encode('hex', true);
        const privateKeyStr = key.getPrivate().toString('hex');
        localStorage.setItem(newSessionId, JSON.stringify({ privateKey1: privateKeyStr }));
        const inviteUrl = `${baseUrl}/?session=${encodeURIComponent(newSessionId)}&public1=${encodeURIComponent(publicKeyStr)}`;
        displayUrl = inviteUrl;
        copyToClipboard(inviteUrl);
        info = infoEnum.start;
    }

    const acceptInvitation = () => {
        if (!sessionId || !public1) return;
        //generate an elliptic curve25519 key pair for key exchange
        const curve = new ec('curve25519');
        const key2 = curve.genKeyPair();
        const publicKey2 = key2.getPublic().encode('hex', true);
        const shared = key2.derive(curve.keyFromPublic(public1, 'hex').getPublic()).toString('hex');
        console.log("shared", shared);
        localStorage.setItem(sessionId, JSON.stringify({ shared }));
        const acceptanceUrl = `${baseUrl}/?session=${sessionId}&public2=${publicKey2}`;
        displayUrl = acceptanceUrl;
        copyToClipboard(acceptanceUrl);
        info=infoEnum.accept;
    }

    const doEncrypt = async () => {
        if (!sessionId) return;
        const cache = localStorage.getItem(sessionId);
        console.log("cache", cache);
        if (!cache) return;
        const session = JSON.parse(cache);
        const shared = session?.shared;
        if (!shared) return;
        console.log("sessionId", sessionId);
        console.log("public1", public1);
        const encrypted = await encrypt(raw, shared);
        console.log("encrypt", encrypted);
        const maskURL = `${baseUrl}/?session=${sessionId}&${ENCRYPTED_MESSAGE}=${encrypted}`;
        displayUrl = maskURL;
        await copyToClipboard(maskURL);
        info=infoEnum.chat;
    }

    onMount(async () => {
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
        if (public2 && !public1) {
            // derive shared key
            const cache = localStorage.getItem(sessionId);
            if (!cache) return;
            const session = JSON.parse(cache);
            const privateKey1 = session?.privateKey1;
            if (!privateKey1) return;
            const key1 = curve.keyFromPrivate(privateKey1);
            const shared = key1.derive(curve.keyFromPublic(public2, 'hex').getPublic()).toString('hex');
            localStorage.setItem(sessionId, JSON.stringify({ shared }));
            status=statusEnum.accept;
            return;
        }
        // in a chat session
        if (!encryptedMessage) {
            console.log("no encrypted message");
            return;
        }
        const cache = localStorage.getItem(sessionId);
        if (!cache) return;
        const session = JSON.parse(cache);
        const sharedKey = session?.shared;
        status=statusEnum.chat;
        console.log("encryptedMessage", encryptedMessage);
        receive=await decrypt(encryptedMessage, sharedKey);
    });
</script>

<div>
    {#if sessionId}<div>sessionId: {sessionId}</div>{/if}
    {#if public1}<div>public1: {public1}</div>{/if}
    {#if public2}<div>public2: {public2}</div>{/if}
    {#if encryptedMessage}<div>encryptedMessage: {encryptedMessage}</div>{/if}
    {#if shared}<div>shared: {shared}</div>{/if}
    <div>{status}</div>
    <button on:click={startSession}>{start}</button>
    {#if public1 && !public2}
        <button on:click={acceptInvitation}>{actionsEnum.accept}</button>
    {/if}
    <div>接受到的信息：{receive}</div>
    <textarea bind:value={raw} placeholder="输入需要加密的信息" class="text-gray-700"></textarea>
    <button on:click={doEncrypt}>加密并生成链接</button>
    <div>{displayUrl}</div>
    <div>{info}</div>
</div>