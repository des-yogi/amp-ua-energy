# svg-спрайт с использованием символов

**ВНИМАНИЕ!** Чтобы использовать ссылки на внешние svg-файлы со спрайтами, используйте [svg4everybody](https://www.npmjs.com/package/svg4everybody) (включен в сборку по умолчанию).

Из файлов папки `svg/` в папку `img/` будет сгенерирован файл спрайта `sprite-svg.svg`.

Сам спрайт имеет вид:

```html
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <symbol id="icon-1" viewBox="0 0 30 30"><path fill="#444" d="..."/></symbol>
  <symbol id="icon-2" viewBox="0 0 28 28"><path fill="#444" d="..."/></symbol>
</svg>
```

Для вставки на страницу используйте конструкции `svg > use` со ссылками на `id` символа:

```html
<svg width="30" height="30"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="img/sprite-svg.svg#temp-icon-right-arrow"></use></svg>
```

Fallback для отображениея инлайнового svg без полифила "SVG for Everybody":
1. Простой вариант, если svg не содержит текстовый узел
<svg viewBox="-20 -20 40 40">
  <!-- SVG code snipped -->
  <image src="fallback.png" xlink:href="" />
</svg>

2. Вариант с текстом внутри svg (добавлена обертка <a></a>):
  a) .hide-on-fallback {
      display: block;
      position: absolute;
      left: -100%;
      height: 0;
      width: 0;
      overflow: hidden;
    }
  b)
  <svg viewBox="-20 -20 40 40">
    <a class="hide-on-fallback">
      <circle fill="limegreen" r="19" />
      <path stroke="forestgreen" fill="none" stroke-width="6"
            d="M-12,3 L-3,10 11,-12" />
      <text dy="0.35em" text-anchor="middle" font-weight="bold"
            font-size="18px" font-family="sans-serif"
            fill="indigo">SVG</text>
    </a>
    <image src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/91525/svg-no.png"
           xlink:href=""/>
  </svg>
