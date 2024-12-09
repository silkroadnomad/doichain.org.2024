<script>
    export let transactionFee;
    export let totalAmount;
    export let selectedUtxosSum;
    export let changeAmount;
    import * as sb from 'satoshi-bitcoin';
  </script>
  
  {#if transactionFee !== undefined && totalAmount !== undefined && changeAmount !== undefined}
    <div class="mt-4 text-right">
      <p class="flex justify-end">
        <span class="font-semibold mr-2">UTXOs Sum:</span>
        <span class="flex-1 text-right">{sb.toBitcoin(Math.round(selectedUtxosSum)).toFixed(8)}</span>
        <span class="ml-1">DOI</span>
      </p>
      <p class="flex justify-end">
        <span class="font-semibold mr-2">Fee:</span>
        <span class="flex-1 text-right">{sb.toBitcoin(Math.round(transactionFee)).toFixed(8)}</span>
        <span class="ml-1">DOI</span>
      </p>
      <p class="flex justify-end">
        <span class="font-semibold mr-2">Change:</span>
        <span class="flex-1 text-right">{sb.toBitcoin(Math.round(changeAmount)).toFixed(8)}</span>
        <span class="ml-1">DOI</span>
      </p>
      <p class="flex justify-end">
        <span class="font-semibold mr-2">Total:</span>
        <span class="flex-1 text-right">{sb.toBitcoin(Math.round(totalAmount)).toFixed(8)}</span>
        <span class="ml-1">DOI</span>
      </p>
    </div>
  {/if}