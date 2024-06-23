<script lang="ts">
    import pkg from 'elliptic';
    import AES from 'crypto-js/aes';
    import Utf8 from 'crypto-js/enc-utf8';
    import {onMount} from 'svelte';
    import {page} from '$app/stores';
    import {goto} from "$app/navigation";

    const {ec} = pkg;

    function encryptString(str: string, key: string): string {
        console.log("str to encrypt", str);
        return AES.encrypt(str, key).toString();
    }
    // Function to decrypt a string
    function decryptString(ciphertext: string, key: string): string {
        const bytes  = AES.decrypt(ciphertext, key);
        console.log("bytes", bytes);
        return bytes.toString(Utf8);
    }

    const ENCRYPTED_MESSAGE = 'encryptedMessage';
    let action: string = "";
    $: urlParams = $page.url.searchParams;
    $: baseUrl = $page.url.protocol + '//' + $page.url.host;
    $: public1 = urlParams.get('public1')?.toString();
    $: public2 = urlParams.get('public2')?.toString();
    $: encryptedMessage = urlParams.get(ENCRYPTED_MESSAGE)?.toString();
    $: sessionId = urlParams.get('session')?.toString();

    $: action = public1 && !public2 ? actionsEnum.accept : actionsEnum.start;

    enum statusEnum {
        none = "No ongoing session",
        inviteGenerated = "Invite generated. Please send off the link",
        invited = "Invited to a session",
        exchange = "Exchanging keys. Please send the new link back",
        chat = "Key exchanged. Chatting",
        error = "Error"
    }

    const statusColor: Record<string, string> = {
        "No ongoing session": "bg-gray-500",
        "Invite generated. Please send off the link": "bg-blue-800",
        "Invited to a session": "bg-yellow-900",
        "Exchanging keys. Please send the new link back": "bg-emerald-800",
        "Key exchanged. Chatting": "bg-green-800",
        "Error": "bg-red-900"
    };

    enum actionsEnum {
        start = "Initiate a session",
        accept = "Accept invitation",
        chat = "加密并生成链接",
    }

    let shared: string = "";
    let status:string = "";
    let displayUrl:string = "";
    let raw: string = ""
    let received: string = ""
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
        status = statusEnum.inviteGenerated;
        copyToClipboard(inviteUrl);
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
        status = statusEnum.exchange;
        copyToClipboard(acceptanceUrl);
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
        if (!raw || raw.length < 1) {
            alert("Please enter a message to encrypt");
            return;
        }
        const encrypted = encryptString(raw, shared);
        console.log("encrypted", encrypted);
        const maskURL = `${baseUrl}/?session=${sessionId}&${ENCRYPTED_MESSAGE}=${encodeURIComponent(encrypted)}`;
        displayUrl = maskURL;
        await copyToClipboard(maskURL);
    }

    onMount(async () => {
        // fresh page no nothing
        if (!sessionId) {
            status=statusEnum.none;
            return;
        }
        // accept invitation when public1 is not empty and public2 is empty
        if (public1 && !public2) {
            status = statusEnum.invited;
        }
        if (public2 && !public1) {
            // derive shared key
            const cache = localStorage.getItem(sessionId);
            if (!cache) {
                status=statusEnum.error;
                return;
            }
            const session = JSON.parse(cache);
            const privateKey1 = session?.privateKey1;
            if (!privateKey1) {
                status=statusEnum.error;
                return;
            }
            const key1 = curve.keyFromPrivate(privateKey1);
            const shared = key1.derive(curve.keyFromPublic(public2, 'hex').getPublic()).toString('hex');
            localStorage.setItem(sessionId, JSON.stringify({ shared }));
            status=statusEnum.chat;
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
        const decodedEncrypted = decodeURIComponent(encryptedMessage);
        console.log("encryptedMessage", decodedEncrypted);
        received = decryptString(encryptedMessage, sharedKey);
        console.log("received", received);
    });
</script>

<div class="p-2 whitespace-normal m:text-sm lg:text-base flex flex-col gap-2 truncate">

    {#if sessionId}
        <div class="font-bold">SessionId: <span>{sessionId}</span></div>
    {:else}
        <div></div>
    {/if}
    <div class="flex gap-1 justify-between items-center">
        <div class="font-bold">Status: <span class={"font-normal py-1 px-2 rounded " + (statusColor[status])}>{status}</span></div>
        <button class="p-2 rounded border border-gray-500" on:click={()=>{
            localStorage.clear();
            status = statusEnum.none;
            goto('/')
        }}>Refresh</button>
    </div>
    {#if shared}<div>shared:{shared}</div>{/if}
    <div class="flex gap-2 items-center">

    </div>
    <div class = "flex flex-col justify-center items-center">
        {#if status === statusEnum.none || status === statusEnum.error}
            <button class="p-2 border rounded border-gray-400 hover:scale-105 transition duration-300 ease-in-out"
                    on:click={startSession}>{action}</button>
        {/if}
        {#if public1 && !public2}
            <button class="p-2 border rounded border-gray-400 hover:scale-105 transition duration-300 ease-in-out"
                    on:click={acceptInvitation}>{action}</button>
        {/if}
    </div>

    {#if received}
        <div class="font-bold">Received：<span class="font-normal">{received}</span></div>
    {/if}
    <textarea bind:value={raw} placeholder="输入需要加密的信息" class="text-gray-700 text-base p-1 rounded"></textarea>
    <button on:click={doEncrypt}>加密并生成链接</button>
    {#if displayUrl && displayUrl.length > 2}
        <span>URL has been copied to clipboard:</span>
        <p class="text-gray-700">{displayUrl}</p>
    {/if}
</div>