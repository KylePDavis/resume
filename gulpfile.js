"use strict";

var gulp = require("gulp"),
	gulpLoadPlugins = require("gulp-load-plugins"),
	del = require("del"),
	fs = require("fs"),
	path = require("path"),
	through = require("through2"),
	roaster = require("roaster"),
	pdf = require("html-pdf");


var $ = gulpLoadPlugins(),
	opts = {
		isDebug: Boolean($.util.env.debug),
		md: {},
		pdf: {
			type: "pdf",
			width: "8.5in",
			height: "11in",
			border: "0in", // handled via CSS
		},
	},
	errLogger = function(err) {
		$.util.log($.util.colors.red("Error: "), String(opts.isDebug ? err.stack : err));
		throw err;
	},
	md2html = function(opts) {
		if (!opts) opts = {};
		var tmplPath = opts.template ? fs.realpathSync(opts.template) : path.join(__dirname, "/src/template/index.html"),
			tmpl = fs.readFileSync(tmplPath, "utf8");
		return through.obj(function(file, encoding, done) {
			var md = file.contents.toString();
			file.path = file.path.replace(/\.md$/, ".html");
			roaster(md, opts, function(err, contents) {
				if (err) return done(err);
				var html = tmpl.replace("{{content}}", contents);
				file.contents = new Buffer(html);
				done(null, file);
			});
		});
	},
	html2pdf = function(opts) {
		if (!opts) opts = {};
		return through.obj(function(file, encoding, done) {
			var baseUri = "file://" + path.dirname(file.path) + "/",
				html = file.contents.toString()
					.replace("<head>", "<head>\n<base href=" + JSON.stringify(baseUri) + ">\n");
			file.path = file.path.replace(/\.html$/, ".pdf");
			pdf.create(html, opts)
				.toBuffer(function(err, buf) {
					if (err) return done(err);
					file.contents = buf;
					done(null, file);
				});
		});
	};


gulp

.task("default", ["build"], function() {})

.task("deploy", ["build"], function() {
	return gulp
		.src("dist/**/*")
		.pipe($.plumber(errLogger))
		.pipe($.if(opts.isDebug, $.debug()))
		.pipe($.ghPages({
			push: !$.util.env.nopush,
		}));
})

.task("clean", function() {
	del.sync(["dist/**/*"]);
})

.task("watch", ["build"], function() {
	gulp.watch([
		"src/template/**/*",
		"src/resume.md",
	], ["build"]);
})

.task("build", ["clean", "build:pdf"], function() {})

.task("build:pdf", ["build:html"], function() {
	return gulp
		.src("dist/index.html")
		.pipe($.plumber(errLogger))
		.pipe(html2pdf(opts.pdf))
		.pipe($.rename("resume.pdf"))
		.pipe(gulp.dest("dist"))
		.pipe($.if(opts.isDebug, $.debug()));
})

.task("build:html", function() {
	return gulp
		.src([
			"src/template/**/*",
			"src/resume.md",
		])
		.pipe($.plumber(errLogger))
		.pipe($.if("**/resume.md", md2html(opts.md)))
		.pipe($.if("**/resume.html", $.rename("index.html")))
		.pipe(gulp.dest("dist"))
		.pipe($.if(opts.isDebug, $.debug()));
})

;
