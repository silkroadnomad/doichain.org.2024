<script>
	import "../app.css";
	import Navigation from './navigation.svelte'
</script>
<body class="bg-white text-gray-900 flex flex-col min-h-screen">
	<section class="flex items-center justify-center mt-8">
		<div class="text-center max-w-4xl mx-auto px-4">
			<!-- Logo -->
			<div class="flex justify-center mb-12">
				<div class="bg-gray-900 rounded-full p-4">
					<img src="/doichain_logo-min.svg" alt="Doichain Logo" class="h-16">
				</div>
			</div>
		</div>
	</section>

	<main class="flex-grow">
		<slot />
	</main>

	<Navigation />
</body>

<style>
    body {
        font-family: 'Poppins', sans-serif;
    }
</style>