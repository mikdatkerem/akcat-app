export default {
  fetch() {
    // API istekleri bağımsız akcat-api servisine yönlendirilmelidir.
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
