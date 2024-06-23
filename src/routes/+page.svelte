<script lang="ts">
    import pkg from 'elliptic';
    import {onMount} from 'svelte';
    import {page} from '$app/stores';
    import {decrypt, encrypt} from "./utils";
    import {goto} from "$app/navigation";

    const {ec} = pkg;

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

    // map from status to color
    const statusColor = {
        [statusEnum.none]: "bg-gray-500",
        [statusEnum.inviteGenerated]: "bg-blue-800",
        [statusEnum.invited]: "bg-yellow-900",
        [statusEnum.exchange]: "bg-emerald-800",
        [statusEnum.chat]: "bg-green-800",
        [statusEnum.error]: "bg-red-900"
    }

    enum actionsEnum {
        start = "Initiate a session",
        accept = "Accept invitation",
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
        const encrypted = await encrypt(raw, shared);
        console.log("encrypt", encrypted);
        const maskURL = `${baseUrl}/?session=${sessionId}&${ENCRYPTED_MESSAGE}=${encrypted}`;
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
        console.log("encryptedMessage", encryptedMessage);
        receive=await decrypt(encryptedMessage, sharedKey);
    });
</script>

<div class="p-2 whitespace-normal m:text-sm lg:text-base flex flex-col gap-2 truncate">

    {#if sessionId}
        <div class="font-bold">SessionId: <span>{sessionId}</span></div>
    {:else}
        <div></div>
    {/if}
    <div class="flex gap-1 justify-between items-center">
        <div class="font-bold">Status: <span class={"font-normal p-1 rounded " + (statusColor[status])}>{status}</span></div>
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
            <button class="p-2 border rounded border-gray-400 hover:scale-105 transition duration-300 ease-in-out" on:click={acceptInvitation}>{action}</button>
        {/if}
    </div>

    <div>接受到的信息：{receive}</div>
    <textarea bind:value={raw} placeholder="输入需要加密的信息" class="text-gray-700"></textarea>
    <button on:click={doEncrypt}>加密并生成链接</button>
    {#if displayUrl && displayUrl.length > 2}
        <span>URL has been copied to clipboard:</span>
        <p class="text-gray-700">{displayUrl}</p>
    {/if}
</div>