<script>
    import "../app.css";
</script>
<div class="w-full h-full">
    <slot />
</div>
<style lang="postcss">
    :global(html) {
        background-color: #1b1b1b;
        color: #ffffff;
    }
</style>