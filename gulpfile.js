/* Dependencies */
const gulp = require('gulp');
const plumber = require('gulp-plumber');
//const autoprefixer = require('gulp-autoprefixer');
const autoprefixer = require("autoprefixer");
const fileinclude = require('gulp-file-include');
const sass = require('gulp-sass');
const filter = require('gulp-filter')
const minimist = require('minimist');
const del = require('del');
const gulpAmpValidator = require('gulp-amphtml-validator');
const bs = require('browser-sync').create();
const reload = bs.reload;
const nodemon = require('gulp-nodemon');
const replace = require('gulp-replace');
const noop = require('gulp-noop');
const through2 = require('through2');
//const mergeMediaQuery = require('gulp-merge-media-queries');
const sortMediaQueries = require('postcss-sort-media-queries');
const AmpOptimizer = require('@ampproject/toolbox-optimizer');
// добавлено
const notify = require('gulp-notify');
const postcss = require('gulp-postcss');
const inlineSVG = require('postcss-inline-svg');
const csso = require('gulp-csso');
const rename = require('gulp-rename');

const ampOptimizer = AmpOptimizer.create();

// Build type is configurable such that some options can be changed e.g. whether
// to minimise CSS. Usage 'gulp <task> --env development'.
const knownOptions = {
    string: 'env',
    default: { env: process.env.NODE_ENV || 'dist' }
};

const options = minimist(process.argv.slice(2), knownOptions);

const paths = {
    css: {
        src: 'src/sass/**/*.scss',
        dest: 'src/css/'
    },
    html: {
        src: 'src/html/pages/*.html',
        dest: 'dist/'
    },
    images: {
        src: 'src/img/**/*.{gif,jpg,png,svg}',
        dest: 'dist/img'
    },
    sprite: {
        src: 'src/sprite-svg/*.svg',
        dest: 'dist/img'
    },
    favicon: {
        src: 'src/favicon/*',
        dest: 'dist/'
    },
    rootConfig: {
        src: 'src/rootConfigFiles/*',
        dest: 'dist/'
    },
    server: {
        src: 'src/server/**/*',
        dest: 'dist/server'
    }
};

let plugins = [
  autoprefixer(),
  inlineSVG(),
  sortMediaQueries(),
];

//.pipe(mergeMediaQuery({log: true})) - удалено для теста нового плагина

/**
 * Builds the styles, bases on SASS files taken from src. The resulting CSS is
 * used as partials that are included in the final AMP HTML.
 * When SASS sees a non-ASCII character in a file, it starts the CSS file it builds with "@charset "UTF-8";".
 * That's great in CSS files, but not accepted within <style> tags.
 * So unless the SASS team takes on https://github.com/sass/sass/issues/2288, we need to remove it.
 */

gulp.task('styles', function buildStyles() {
    const cssEncodingDirective = '@charset "UTF-8";';

    return gulp.src(paths.css.src)
        .pipe(plumber({
          errorHandler: function(err) {
            notify.onError({
              title: 'Styles compilation error',
              message: err.message
            })(err);
            this.emit('end');
          }
        }))
        .pipe(sass(options.env === 'dist' ? { outputStyle: 'compressed' } : {}))
        .pipe(options.env === 'dev' ? replace(cssEncodingDirective, '') : noop())
        .pipe(postcss(plugins))
        .pipe(csso())
        .pipe(gulp.dest(paths.css.dest));
});

/**
 * Copies the images to the distribution.
 */
gulp.task('images', function buildImages() {
    return gulp.src(paths.images.src)
        .pipe(gulp.dest(paths.images.dest));
});

/**
 * Copies the favicon to the distribution.
 */
gulp.task('favicon', function buildImages() {
    return gulp.src(paths.favicon.src)
        .pipe(gulp.dest(paths.favicon.dest));
});

// Сборка SVG-спрайта для блока sprite-svg (IE не поддержитвается без полифила SVG for Everybody)
gulp.task('sprite:svg', function (callback) {
  const svgstore = require('gulp-svgstore');
  const svgmin = require('gulp-svgmin');
  const cheerio = require('gulp-cheerio');

  console.log('---- Сборка SVG спрайта');
  return gulp.src(paths.sprite.src)
    .pipe(svgmin(function (file) {
      return {
        plugins: [{
          cleanupIDs: {
            minify: true
          }
        }]
      }
    }))
    .pipe(svgstore({ inlineSvg: true }))
    .pipe(cheerio({
      run: function($) {
        $('svg').attr('style',  'display:none');
      },
      parserOptions: {
        xmlMode: true
      }
    }))
    .pipe(rename('sprite-svg.svg'))
    .pipe(gulp.dest(paths.sprite.dest));
});

/**
 * Copies the root config files to the distribution.
 */
gulp.task('rootConfig', function buildImages() {
    return gulp.src(paths.rootConfig.src)
        .pipe(gulp.dest(paths.rootConfig.dest));
});


/**
 * Copies the server and helper classes to the distribution.
 */
gulp.task('server', function buildImages() {
    return gulp.src(paths.server.src)
        .pipe(gulp.dest(paths.server.dest));
});

/**
 * Builds the HTML files. Only files from 'pages' are built.
 * We don't want to build partials!
 * Use the AMP Optimizer to add any scripts required by AMP components,
 * and to perform the optimizations done by AMP caches right here in our HTML,
 * greatly speeding up our AMP pages when served from our origin.
 */
gulp.task('html', gulp.series('styles', function buildHtml() {
    const pageFilter = filter(['**/pages/*.html']);

    return gulp.src(paths.html.src)
        .pipe(pageFilter)
        .pipe(fileinclude({
            prefix: '%%',
            basepath: '@file'
        }))
    .pipe(through2.obj(async (file, _, cb) => {
      if (file.isBuffer()) {
        const optimizedHtml = await ampOptimizer.transformHtml(file.contents.toString())
        file.contents = Buffer.from(optimizedHtml)
      }
      cb(null, file);
    }))
    .pipe(gulp.dest(paths.html.dest));
}));

/**
 * Checks resulting output AMP HTML for validity.
 */
gulp.task('validate', function validate() {
    return gulp.src(paths.html.dest + '/**/*.html')
        .pipe(gulpAmpValidator.validate())
        .pipe(gulpAmpValidator.format())
        .pipe(gulpAmpValidator.failAfterError());
});

/**
 * Removes all files from the distribution directory, and also the CSS build
 * directory.
 */
gulp.task('clean', function clean() {
    return del([
        paths.html.dest + '/**/*',
        paths.css.dest + '/**/*'
    ]);
});

/**
 * Builds the output from sources.
 */
gulp.task('build', gulp.series('images', 'sprite:svg', 'favicon', 'rootConfig', 'html', 'server', 'validate'));

/**
 * First rebuilds the output then triggers a reload of the browser.
 */
gulp.task('rebuild', gulp.series('build', function rebuild(done) {
    bs.reload();
    done();
}));

/**
 * Sets up the live browser sync.
 */
/*
gulp.task('serve', function sync(done) {
    bs.init({
        server: {
            baseDir: 'dist/'
        }
    });
    done();
});
*/
gulp.task('browser-sync', function sync(done) {
    bs.init(null, {
        proxy: "http://localhost:8080", // port of node server
        //open: true,
    });
    done();
});

gulp.task('nodemon', function (cb) {
    var callbackCalled = false;
    return nodemon({script: './dist/server/server.js'}).on('start', function () {
        if (!callbackCalled) {
            callbackCalled = true;
            cb();
        }
    });
});

/**
 * Sets up live-reloading: Changes to HTML or CSS trigger a rebuild, changes to
 * images, favicon, root config files and server only result in images, favicon, root config files, server and helper classes being copied again to dist.
 */
gulp.task('watch', function watch(done) {
    gulp.watch(paths.images.src, gulp.series('images'));
    gulp.watch(paths.sprite.src, gulp.series('sprite:svg'));
    gulp.watch(paths.favicon.src, gulp.series('favicon'));
    gulp.watch(paths.rootConfig.src, gulp.series('rootConfig'));
    gulp.watch(paths.server.src, gulp.series('server'));
    gulp.watch('src/html/**/*.html', gulp.series('rebuild'));
    gulp.watch(paths.css.src, gulp.series('rebuild'));
    done();
});

/**
 * Prepares a clean build.
 */
gulp.task('prepare', gulp.series('clean', 'build'));

/**
 * Default task is to perform a clean build then set up browser sync for live
 * reloading.
 */
gulp.task('default', gulp.series('build', 'nodemon', 'browser-sync', 'watch'));

