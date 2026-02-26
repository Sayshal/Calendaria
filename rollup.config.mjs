import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';

const isDev = process.env.BUILD === 'development';

export default {
  input: 'calendaria.mjs',
  output: {
    file: 'dist/calendaria.mjs',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true
  },
  plugins: [
    postcss({
      extract: 'styles/calendaria.css',
      minimize: !isDev
    }),
    !isDev &&
      terser({
        format: { comments: false }
      }),
    copy({
      targets: [
        { src: 'templates', dest: 'dist' },
        { src: 'lang', dest: 'dist' },
        { src: 'calendars', dest: 'dist' },
        { src: 'assets', dest: 'dist' },
        { src: 'module.json', dest: 'dist' },
        { src: 'LICENSE', dest: 'dist' }
      ]
    })
  ]
};
