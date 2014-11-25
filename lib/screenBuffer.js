/*
	The Cedric's Swiss Knife (CSK) - CSK terminal toolbox
	
	Copyright (c) 2009 - 2014 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

// Load modules
var tree = require( 'tree-kit' ) ;
//var async = require( 'async-kit' ) ;
var string = require( 'string-kit' ) ;
var punycode = require( 'punycode' ) ;



function ScreenBuffer() { throw new Error( 'Cannot create ScreenBuffer object directly.' ) ; }
module.exports = ScreenBuffer ;



/*
	options:
		* width: mandatory
		* height: mandatory
		* target: default target
		* x: default position in target
		* y: default position in target
		* wrap: default behaviour of .put()
		* noClear: do not call .clear() at ScreenBuffer creation
*/
ScreenBuffer.create = function create( options )
{
	// Manage options
	if ( ! options ) { options = {} ; }
	
	var screenBuffer = Object.create( ScreenBuffer.prototype , {
		// a terminal or another screenBuffer
		target: { value: options.target , writeable: true , enumerable: true } ,
		width: { value: options.width || ( options.target ? options.target.width : 1 ) , enumerable: true } ,
		height: { value: options.height || ( options.target ? options.target.height : 1 ) , enumerable: true } ,
		wrap: { value: options.wrap !== undefined ? options.wrap : true , writable: true , enumerable: true } ,
		x: { writable: true , enumerable: true , value:
			options.x !== undefined ? options.x : ( options.target && options.target.Terminal ? 1 : 0 )
		} ,
		y: { writable: true , enumerable: true , value:
			options.y !== undefined ? options.y : ( options.target && options.target.Terminal ? 1 : 0 )
		} ,
		cx: { value: 0 , writable: true , enumerable: true } ,
		cy: { value: 0 , writable: true , enumerable: true }
	} ) ;
	
	Object.defineProperties( screenBuffer , {
		buffer: { value: new Buffer( screenBuffer.width * screenBuffer.height * ITEM_SIZE ) , enumerable: true } ,
		lineBuffer: { value: new Array( screenBuffer.height ) , enumerable: true }
	} ) ;
	
	if ( ! options.noClear ) { screenBuffer.clear() ; }
	
	return screenBuffer ;
} ;



/*
	options:
		* attr: attributes passed to .put()
		* transparencyChar: a char that is transparent
*/
ScreenBuffer.createFromDataString = function createFromDataString( options , data )
{
	var x , y , len , attr , attrTrans , width , height , screenBuffer ;
	
	// Manage options
	if ( ! options ) { options = {} ; }
	
	
	if ( typeof data !== 'string' )
	{
		if ( ! data.toString ) { throw new Error( '[terminal] ScreenBuffer.createFromDataString(): argument #1 should be a string or provide a .toString() method.' ) ; }
		data = data.toString() ;
	}
	
	// Transform the data into an array of lines
	data = ScreenBuffer.stripControlChars( data , true ).split( '\n' ) ;
	
	// Compute the buffer size
	width = 0 ;
	height = data.length ;
	attr = ScreenBuffer.object2attr( options.attr ) ;
	attrTrans = ScreenBuffer.object2attr( tree.extend( null , {} , options.attr , { transparency: true } ) ) ;
	
	for ( y = 0 ; y < data.length ; y ++ )
	{
		if ( data[ y ].length > width ) { width = data[ y ].length ; }
	}
	
	// Create the buffer with the right width & height
	screenBuffer = ScreenBuffer.create( { width: width , height: height } ) ;
	
	// Fill the buffer with data
	for ( y = 0 ; y < data.length ; y ++ )
	{
		if ( ! options.transparencyChar )
		{
			screenBuffer.put( { x: 0 , y: y , attr: attr } , data[ y ] ) ;
		}
		else
		{
			len = data[ y ].length ;
			
			for ( x = 0 ; x < len ; x ++ )
			{
				if ( data[ y ][ x ] === options.transparencyChar )
				{
					screenBuffer.put( { x: x , y: y , attr: attrTrans } , data[ y ][ x ] ) ;
				}
				else
				{
					screenBuffer.put( { x: x , y: y , attr: attr } , data[ y ][ x ] ) ;
				}
			}
		}
	}
	
	return screenBuffer ;
} ;



ScreenBuffer.prototype.clear = function clear()
{
	//this.buffer.fill( 0 ) ; return this ;
	
	var i , length = this.width * this.height ;
	
	for ( i = 0 ; i < length ; i ++ )
	{
		CLEAR_BUFFER.copy( this.buffer , i * ITEM_SIZE ) ;
	}
	
	return this ;
} ;



/*
	options:
		* x: bypass this.cx
		* y: bypass this.cy
		* 
*/
ScreenBuffer.prototype.put = function put( options , str )
{
	var x , y , attr , i , offset ;
	var characters = punycode.ucs2.decode( str ) ;
	var len = characters.length ;
	
	
	// Manage options
	if ( ! options ) { options = {} ; }
	
	x = options.x !== undefined ? options.x : this.cx ;
	y = options.y !== undefined ? options.y : this.cy ;
	
	if ( typeof x !== 'number' || x < 0 ) { x = 0 ; }
	else if ( x >= this.width ) { x = this.width - 1 ; }
	else { x = Math.floor( x ) ; }
	
	if ( typeof y !== 'number' || y < 0 ) { y = 0 ; }
	else if ( y >= this.height ) { y = this.height - 1 ; }
	else { y = Math.floor( y ) ; }
	
	attr = options.attr !== undefined ? options.attr : DEFAULT_ATTR ;
	
	if ( attr && typeof attr === 'object' ) { attr = ScreenBuffer.object2attr( attr ) ; }
	if ( typeof attr !== 'number' ) { attr = DEFAULT_ATTR ; }
	
	// Process the input string
	if ( arguments.length > 2 ) { str = string.format.call( undefined , Array.prototype.slice.apply( arguments , 1 ) ) ; }
	str = ScreenBuffer.stripControlChars( str ) ;
	
	this.lineBuffer[ y ] = undefined ;	// this line should be invalidated in the lineBuffer
	
	for ( i = 0 ; i < len ; i ++ )
	{
		offset = ( y * this.width + x ) * ITEM_SIZE ;
		
		// Write the attributes
		this.buffer.writeUInt32LE( attr , offset ) ;
		
		// Write the character
		this.buffer.write( punycode.ucs2.encode( [ characters[ i ] ] ) , offset + ATTR_SIZE , CHAR_SIZE ) ;
		
		x ++ ;
		
		if ( x >= this.width )
		{
			if ( ! this.wrap ) { break ; }
			
			x = 0 ;
			y ++ ;
			
			if ( y >= this.height ) { break ; }
			
			this.lineBuffer[ y ] = undefined ;	// this line should be invalidated in the lineBuffer
		}
	}
	
	this.cx = x ;
	this.cy = y ;
	
	return ;
} ;



ScreenBuffer.prototype.draw = function draw( options )
{
	if ( ! options || typeof options !== 'object' ) { options = {} ; }
	
	if ( ! options.target ) { options.target = this.target ; }
	if ( options.x === undefined ) { options.x = this.x ; }
	if ( options.y === undefined ) { options.y = this.y ; }
	
	if ( options.target instanceof ScreenBuffer )
	{
		if ( options.transparency ) { return this.draw2bufferTransparency( options ) ; }
		else { return this.draw2buffer( options ) ; }
	}
	else if ( options.target.Terminal )
	{
		return this.draw2terminal( options ) ;
	}
	else { return false ; }
} ;



ScreenBuffer.prototype.draw2terminal = function draw2terminal( options )
{
	var x , y , xmin , xmax , ymin , ymax , offset , line , attr , lastAttr ;
	var nfterm = options.target.noFormat ;	// no format term (faster)
	
	// min & max in the buffer coordinate
	xmin = Math.max( 0 , 1 - options.x ) ;
	xmax = Math.min( this.width - 1 , options.target.width - options.x ) ;
	ymin = Math.max( 0 , 1 - options.y ) ;
	ymax = Math.min( this.height - 1 , options.target.height - options.y ) ;
	
	if ( xmax < xmin || ymax < ymin ) { return ; }
	
	for ( y = ymin ; y <= ymax ; y ++ )
	{
		line = '' ;
		
		for ( x = xmin ; x <= xmax ; x ++ )
		{
			offset = ( y * this.width + x ) * ITEM_SIZE ;
			attr = this.buffer.readUInt32LE( offset ) ;
			
			if ( attr !== lastAttr )
			{
				line += ScreenBuffer.generateEscapeSequence( options.target , attr ) ;
				lastAttr = attr ;
			}
			
			line += ScreenBuffer.readChar( this.buffer , offset + ATTR_SIZE ) ;
		}
		
		nfterm.moveTo( xmin + options.x , y + options.y , line ) ;
	}
} ;



ScreenBuffer.prototype.draw2buffer = function draw2buffer( options )
{
	var y , xmin , xmax , ymin , ymax , start , end , targetStart ;
	
	// min & max in the buffer coordinate
	xmin = Math.max( 0 , - options.x ) ;
	xmax = Math.min( this.width - 1 , options.target.width - 1 - options.x ) ;
	ymin = Math.max( 0 , - options.y ) ;
	ymax = Math.min( this.height - 1 , options.target.height - 1 - options.y ) ;
	
	if ( xmax < xmin || ymax < ymin ) { return ; }
	//console.error( 'draw2buffer region' , xmin , xmax , ymin , ymax ) ;
	
	for ( y = ymin ; y <= ymax ; y ++ )
	{
		start = ( y * this.width + xmin ) * ITEM_SIZE ;
		end = ( y * this.width + xmax + 1 ) * ITEM_SIZE ;
		targetStart = ( ( y + options.y ) * options.target.width + xmin + options.x ) * ITEM_SIZE ;
		
		//console.error( 'draw2buffer copy' , targetStart , start , end ) ;
		
		this.buffer.copy( options.target.buffer , targetStart , start , end ) ;
	}
} ;



ScreenBuffer.prototype.draw2bufferTransparency = function draw2bufferTransparency( options )
{
	var x , y , xmin , xmax , ymin , ymax , start , end , targetStart ;
	
	// min & max in the buffer coordinate
	xmin = Math.max( 0 , - options.x ) ;
	xmax = Math.min( this.width - 1 , options.target.width - 1 - options.x ) ;
	ymin = Math.max( 0 , - options.y ) ;
	ymax = Math.min( this.height - 1 , options.target.height - 1 - options.y ) ;
	
	if ( xmax < xmin || ymax < ymin ) { return ; }
	//console.error( 'draw2bufferTransparency region' , xmin , xmax , ymin , ymax ) ;
	
	for ( y = ymin ; y <= ymax ; y ++ )
	{
		for ( x = xmin ; x <= xmax ; x ++ )
		{
			start = ( y * this.width + x ) * ITEM_SIZE ;
			end = start + ITEM_SIZE ;
			targetStart = ( ( y + options.y ) * options.target.width + x + options.x ) * ITEM_SIZE ;
			
			//console.error( 'draw2bufferTransparency copy' , targetStart , start , end ) ;
			
			if ( ! ( this.buffer.readUInt32LE( start ) & ( TRANSPARENCY << 24 ) ) )
			{
				this.buffer.copy( options.target.buffer , targetStart , start , end ) ;
			}
		}
	}
} ;



ScreenBuffer.prototype.dumpChars = function dumpChars()
{
	var y , x , offset ;
	
	process.stdout.write( '\nDumping the buffer (characters only):\n' ) ;
	
	for ( y = 0 ; y < this.height ; y ++ )
	{
		process.stdout.write( y + ' > ' ) ;
		
		for ( x = 0 ; x < this.width ; x ++ )
		{
			offset = ( y * this.width + x ) * ITEM_SIZE ;
			//process.stdout.write( this.buffer.toString( 'utf8' , offset + ATTR_SIZE , offset + ITEM_SIZE )[ 0 ] ) ;
			process.stdout.write( ScreenBuffer.readChar( this.buffer , offset + ATTR_SIZE ) ) ;
		}
		
		process.stdout.write( '\n' ) ;
	}
	
} ;



ScreenBuffer.prototype.dump = function dump()
{
	var y , x , offset ;
	
	process.stdout.write( '\nDumping the buffer (attributes + characters):\n' ) ;
	
	for ( y = 0 ; y < this.height ; y ++ )
	{
		process.stdout.write( y + ' > ' ) ;
		
		for ( x = 0 ; x < this.width ; x ++ )
		{
			offset = ( y * this.width + x ) * ITEM_SIZE ;
			process.stdout.write( string.format( '%x%x%x%x ' ,
				this.buffer.readUInt8( offset + 3 ) ,
				this.buffer.readUInt8( offset + 2 ) ,
				this.buffer.readUInt8( offset + 1 ) ,
				this.buffer.readUInt8( offset )
			) ) ;
			
			// Issue with character bigger than 16bits, javascript is more like UCS-2 than UTF-16
			//process.stdout.write( this.buffer.toString( 'utf8' , offset + ATTR_SIZE , offset + ITEM_SIZE )[ 0 ] + ' ' ) ;
			process.stdout.write( ScreenBuffer.readChar( this.buffer , offset + ATTR_SIZE ) + ' ' ) ;
		}
		
		process.stdout.write( '\n' ) ;
	}
	
} ;





			/* "static" functions */



ScreenBuffer.readChar = function readChar( buffer , at )
{
	var bytes ;
	
	if ( buffer[ at ] < 0x80 ) { bytes = 1 ; }
	else if ( buffer[ at ] < 0xc0 ) { return '\x00' ; } // We are in a middle of an unicode multibyte sequence... something was wrong...
	else if ( buffer[ at ] < 0xe0 ) { bytes = 2 ; }
	else if ( buffer[ at ] < 0xf0 ) { bytes = 3 ; }
	else if ( buffer[ at ] < 0xf8 ) { bytes = 4 ; }
	else if ( buffer[ at ] < 0xfc ) { bytes = 5 ; }
	else { bytes = 6 ; }
	
	if ( bytes > CHAR_SIZE ) { return '\x00' ; }
	
	return buffer.toString( 'utf8' , at , at + bytes ) ;
} ;



ScreenBuffer.attr2object = function attr2object( attr )
{
	var object = {} ;
	
	object.color = attr & 255 ;
	object.bgColor = ( attr >> 8 ) & 255 ;
	object.style = ( attr >> 16 ) & 255 ;
	object.special = ( attr >> 24 ) & 127 ;
	
	// style part
	if ( object.style & BOLD ) { object.bold = true ; }
	if ( object.style & DIM ) { object.dim = true ; }
	if ( object.style & ITALIC ) { object.italic = true ; }
	if ( object.style & UNDERLINE ) { object.underline = true ; }
	if ( object.style & BLINK ) { object.blink = true ; }
	if ( object.style & INVERSE ) { object.inverse = true ; }
	if ( object.style & HIDDEN ) { object.hidden = true ; }
	if ( object.style & STRIKE ) { object.strike = true ; }
	
	// special part
	if ( object.special & TRANSPARENCY ) { object.transparency = true ; }
	
	return object ;
} ;



ScreenBuffer.object2attr = function object2attr( object )
{
	var attr = 0 ;
	
	if ( ! object || typeof object !== 'object' ) { object = {} ; }
	
	// color part
	if ( typeof object.color === 'string' ) { object.color = ScreenBuffer.color2index( object.color ) ; }
	if ( typeof object.color !== 'number' || object.color < 0 || object.color > 255 ) { object.color = 7 ; }
	else { object.color = Math.floor( object.color ) ; }
	
	attr += object.color ;
	
	// bgColor part
	if ( typeof object.bgColor === 'string' ) { object.bgColor = ScreenBuffer.color2index( object.bgColor ) ; }
	if ( typeof object.bgColor !== 'number' || object.bgColor < 0 || object.bgColor > 255 ) { object.bgColor = 0 ; }
	else { object.bgColor = Math.floor( object.bgColor ) ; }
	
	attr += object.bgColor << 8 ;
	
	// style part
	var style = 0 ;
	if ( object.bold ) { style |= BOLD ; }
	if ( object.dim ) { style |= DIM ; }
	if ( object.italic ) { style |= ITALIC ; }
	if ( object.underline ) { style |= UNDERLINE ; }
	if ( object.blink ) { style |= BLINK ; }
	if ( object.inverse ) { style |= INVERSE ; }
	if ( object.hidden ) { style |= HIDDEN ; }
	if ( object.strike ) { style |= STRIKE ; }
	
	attr += style << 16 ;
	
	// special part
	var special = 0 ;
	if ( object.transparency ) { special |= TRANSPARENCY ; }
	
	attr += special << 24 ;
	
	return attr ;
} ;



ScreenBuffer.color2index = function color2index( color )
{
	switch ( color.toLowerCase() )
	{
		case 'black' : return 0 ;
		case 'red' : return 1 ;
		case 'green' : return 2 ;
		case 'yellow' : return 3 ;
		case 'blue' : return 4 ;
		case 'magenta' : return 5 ;
		case 'cyan' : return 6 ;
		case 'white' : return 7 ;
		case 'brightblack' : return 8 ;
		case 'brightred' : return 9 ;
		case 'brightgreen' : return 10 ;
		case 'brightyellow' : return 11 ;
		case 'brightblue' : return 12 ;
		case 'brightmagenta' : return 13 ;
		case 'brightcyan' : return 14 ;
		case 'brightwhite' : return 15 ;
		default : return undefined ;
	}
} ;



ScreenBuffer.generateEscapeSequence = function generateEscapeSequence( term , attr )
{
	var color = attr & 255 ;
	var bgColor = ( attr >> 8 ) & 255 ;
	var style = ( attr >> 16 ) & 255 ;
	//var special = ( attr >> 24 ) & 127 ;
	
	var esc = term.str.styleReset.color.bgColor( color , bgColor ) ;
	
	// style part
	if ( style & BOLD ) { esc += term.str.bold() ; }
	if ( style & DIM ) { esc += term.str.dim() ; }
	if ( style & ITALIC ) { esc += term.str.italic() ; }
	if ( style & UNDERLINE ) { esc += term.str.underline() ; }
	if ( style & BLINK ) { esc += term.str.blink() ; }
	if ( style & INVERSE ) { esc += term.str.inverse() ; }
	if ( style & HIDDEN ) { esc += term.str.hidden() ; }
	if ( style & STRIKE ) { esc += term.str.strike() ; }
	
	return esc ;
} ;



// Strip all control chars, if newline is true, only newline control chars are preserved
ScreenBuffer.stripControlChars = function stripControlChars( str , newline ) {
	if ( newline ) { return str.replace( /[\x00-\x09\x0b-\x1f\x7f]/g , '' ) ; }
	else { return str.replace( /[\x00-\x1f\x7f]/g , '' ) ; }
} ;





			/* Constants */



var ATTR_SIZE = 4 ;	// do not edit, everything use Buffer.writeUInt32LE()
var CHAR_SIZE = 4 ;
var ITEM_SIZE = ATTR_SIZE + CHAR_SIZE ;

var DEFAULT_ATTR = ScreenBuffer.object2attr( { color: 'white' , bgColor: 'black' } ) ;
var CLEAR_ATTR = ScreenBuffer.object2attr( { color: 'white' , bgColor: 'black' , transparency: true } ) ;
var CLEAR_BUFFER = new Buffer( ITEM_SIZE ) ;
CLEAR_BUFFER.writeUInt32LE( DEFAULT_ATTR , 0 ) ;
//CLEAR_BUFFER.write( ' \x00\x00\x00' , ATTR_SIZE ) ;	// space
CLEAR_BUFFER.write( ' a\x00\x00' , ATTR_SIZE ) ;	// space


// Style mask
var BOLD = 1 ;
var DIM = 2 ;
var ITALIC = 4 ;
var UNDERLINE = 8 ;
var BLINK = 16 ;
var INVERSE = 32 ;
var HIDDEN = 64 ;
var STRIKE = 128 ;



// Special mask
var UPDATED = 1 ;
var TRANSPARENCY = 2 ;





