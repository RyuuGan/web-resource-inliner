"use strict";

var path = require( "path" );
var UglifyJS = require( "uglify-js" );
var xtend = require( "xtend" );
var async = require( "async" );
var inline = require( "./util" );
var css = require( "./css" );

module.exports = function( options, callback )
{
    var settings = xtend({}, inline.defaults, options );

    function replaceInlineAttribute(string) {
        return string
          .replace( new RegExp( " " + settings.inlineAttribute + "-ignore", "gi" ), "" )
          .replace( new RegExp( " " + settings.inlineAttribute, "gi" ), "" );
    }

    var replaceScript = function( callback )
    {
        var args = this;

        args.element = replaceInlineAttribute(args.element);

        inline.getTextReplacement( args.src, settings.relativeTo, function( err, content )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            var js = options.uglify ? UglifyJS.minify( content ).code : content;
            if( typeof( args.limit ) === "number" && js.length > args.limit * 1000 )
            {
                return callback( null );
            }
            var html = '<script' + ( args.attrs ? ' ' + args.attrs : '' ) + '>\n' + js + '\n</script>';

            result = result.replace( new RegExp( inline.escapeSpecialChars(args.element) , "g" ),
                function( ) { return html; } );

            return callback( null );
        } );
    };

    var replaceLink = function( callback )
    {
        var args = this;

        args.element = replaceInlineAttribute(args.element);

        inline.getTextReplacement( args.src, settings.relativeTo, function( err, content )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            if( typeof( args.limit ) === "number" && content.length > args.limit * 1000 )
            {
                return callback( null );
            }

            var cssOptions = xtend( {}, settings, {
                fileContent: content.toString(),
                rebaseRelativeTo: path.relative( settings.relativeTo, path.join( settings.relativeTo, args.src, ".." + path.sep ) )
            } );

            css( cssOptions, function ( err, content )
            {
                if( err )
                {
                    return callback( err );
                }
                var html = '<style' + ( args.attrs ? ' ' + args.attrs : '' ) + '>\n' + content + '\n</style>';

                result = result.replace( new RegExp( inline.escapeSpecialChars(args.element) , "g" ),
                    function( ) { return html; } );

                return callback( null );
            } );
        } );
    };

    var replaceImg = function( callback )
    {
        var args = this;

        args.element = replaceInlineAttribute(args.element);

        inline.getFileReplacement( args.src, settings.relativeTo, function( err, datauriContent )
        {
            if( err )
            {
                return inline.handleReplaceErr( err, args.src, settings.strict, callback );
            }
            if( typeof( args.limit ) === "number" && datauriContent.length > args.limit * 1000 )
            {
                return callback( null );
            }
            var html = '<img' + ( args.attrs ? ' ' + args.attrs : '' ) + ' src="' + datauriContent + '" />';
            result = result.replace( new RegExp( inline.escapeSpecialChars(args.element) , "g" ),
                function( ) { return html; } );
            return callback( null );
        } );
    };

    var result = settings.fileContent;
    var tasks = [];
    var found;

    var scriptRegex = /<script[\s\S]+?src=["']([^"']+?)["'][\s\S]*?>\s*<\/script>/g;
    while( ( found = scriptRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( settings.inlineAttribute + "-ignore", "gi" ) )
            && ( settings.scripts || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) ) )
        {
            tasks.push( replaceScript.bind(
            {
                element: found[ 0 ],
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.scripts
            } ) );
        }
    }

    var linkRegex = /<link[\s\S]+?href=["']([^"']+?)["'][\s\S]*?\/?>/g;
    while( ( found = linkRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( settings.inlineAttribute + "-ignore", "gi" ) )
            && ( settings.links || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) ) )
        {
            tasks.push( replaceLink.bind(
            {
                element: found[ 0 ],
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.links
            } ) );
        }
    }

    var imgRegex = /<img[\s\S]+?src=["']([^"']+?)["'][\s\S]*?\/?\s*?>/g;
    while( ( found = imgRegex.exec( result ) ) !== null )
    {
        if( !found[ 0 ].match( new RegExp( settings.inlineAttribute + "-ignore", "gi" ) )
            && ( settings.images || found[ 0 ].match( new RegExp( settings.inlineAttribute, "gi" ) ) ) )
        {
            tasks.push( replaceImg.bind(
            {
                element: found[ 0 ],
                src: found[ 1 ],
                attrs: inline.getAttrs( found[ 0 ], settings ),
                limit: settings.images
            } ) );
        }
    }

    result = replaceInlineAttribute(result);

    async.parallel( tasks, function( err )
    {
        callback( err, result );
    } );
};
