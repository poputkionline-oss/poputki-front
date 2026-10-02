<template>
    <div class="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-white">
        <p class="text-6xl font-extrabold text-slate-300">404</p>
        <h1 class="mt-4 text-2xl font-bold text-slate-900">Страница не найдена</h1>
        <p class="mt-2 text-slate-500">Такой страницы нет или она была перемещена.</p>
        <router-link to="/"
            class="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg transition-all">
            На главную
        </router-link>
    </div>
</template>
