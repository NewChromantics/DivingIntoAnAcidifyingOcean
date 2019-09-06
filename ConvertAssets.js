Pop.Include('AssetImport.js');
Pop.Include('Animals.js');



function ConvertSceneFile(Filename,Pretty=false)
{
	const CachedFilename = GetCachedFilename(Filename,'scene');
	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	const Scene = LoadSceneFile( Filename );
	const Json = Pretty ? JSON.stringify(Scene,null,'\t') : JSON.stringify(Scene);
	Pop.WriteStringToFile( CachedFilename, Json );
	//Pop.ShowFileInFinder( CachedFilename );
}



function ConvertGeometryFile(Filename,Pretty=false)
{
	Pop.Debug('ConvertGeometryFile',Filename);
	const CachedFilename = GetCachedFilename(Filename,'geometry');

	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	Pop.Debug('ConvertGeometryFile','LoadGeometryFile');
	const Geo = LoadGeometryFile( Filename );
	//const Json = Pretty ? JSON.stringify(Geo,null,'\t') : JSON.stringify(Geo);
	Pop.Debug('ConvertGeometryFile','JSON.stringify');
	const Json = JSON.stringify(Geo);
	Pop.WriteStringToFile( CachedFilename, Json );
	//Pop.ShowFileInFinder( CachedFilename );
}


function CopyPixelBufferToPixelBuffer(DestinationRgba,Source,SourceFormat)
{
	function GetSourceRgba_From_Greyscale(PixelIndex)
	{
		const Grey = Source.slice( PixelIndex*1, (PixelIndex*1)+1 );
		Grey.push(Grey);
		Grey.push(Grey);
		Grey.push(255);
		return Grey;
	}
	function GetSourceRgba_From_Rgb(PixelIndex)
	{
		const Rgb = Source.slice( PixelIndex*3, (PixelIndex*3)+3 );
		Rgb.push(255);
		return Rgb;
	}
	function GetSourceRgba_From_Rgba(PixelIndex)
	{
		const Rgba = Source.slice( PixelIndex*4, (PixelIndex*4)+4 );
		return Rgba;
	}
	
	function GetSourceRgbaFunctor()
	{
		switch(SourceFormat)
		{
			case 'Greyscale':	return GetSourceRgba_From_Greyscale;
			case 'RGB':			return GetSourceRgba_From_Rgb;
			case 'RGBA':		return GetSourceRgba_From_Rgba;
		}
		throw "Currently not supporting " + SourceFormat + " to rgba!";
	};
	
	const GetSourceRgba = GetSourceRgbaFunctor();
	for ( let p=0;	p<DestinationRgba.length/4;	p++ )
	{
		const SourceRgba = GetSourceRgba(p);
		DestinationRgba[(p*4)+0] = SourceRgba[0];
		DestinationRgba[(p*4)+1] = SourceRgba[1];
		DestinationRgba[(p*4)+2] = SourceRgba[2];
		DestinationRgba[(p*4)+3] = SourceRgba[3];
	}
	
}

function ImageToPng(Image,OnPngBytes)
{
	try
	{
		const PngBytes = Image.GetPngData();
		OnPngBytes( PngBytes );
		return;
	}
	catch(e)
	{
		Pop.Debug(e);
	}
	
	Pop.Debug("ImageToPng",Image);
	const Canvas = document.createElement('canvas');
	const Width = Image.GetWidth();
	const Height = Image.GetHeight();
	Canvas.width = Width;
	Canvas.height = Height;
	const Context = Canvas.getContext('2d');
	
	const ImageData = Context.createImageData( Width, Height );
	const Pixels = Image.GetPixelBuffer();
	CopyPixelBufferToPixelBuffer( ImageData.data, Pixels, Image.GetFormat() );

	//	draw back to canvas
	Context.putImageData( ImageData, 0, 0 );

	function OnBlob(PngBlob)
	{
		function OnBlobBuffer(ArrayBuffer)
		{
			OnPngBytes( ArrayBuffer );
		}
		function OnError(Error)
		{
			Pop.Debug("Error getting blob array buffer",Error);
			throw Error;
		}
		PngBlob.arrayBuffer().then( OnBlobBuffer ).catch( OnError );
	}
	Canvas.toBlob( OnBlob, 'image/png', 1.0 );
	/*
	//	try and use this mozilla extension
	const PngFile = Canvas.mozGetAsFile("Filename.png", 'image/png' );
	const PngArrayBuffer = await PngFile.arrayBuffer();
	return PngArrayBuffer;
	 */
}

function StringToBytes(String)
{
	const Bytes = [];
	for ( let i=0;	i<String.length;	i++ )
	{
		let Char = String.charCodeAt(i) & 0xff;
		Bytes.push(Char);
	}
	return Bytes;
}


function BytesToString(Bytes)
{
	let String = "";
	for ( let i=0;	i<Bytes.length;	i++ )
	{
		let Char = String.fromCharCode( Bytes[i] );
		String += Char;
	}
	return String;
}

//	packed PNG file
//	first line is meta, which describes contents of the following lines
function CreatePackedImage(Contents)
{
	Pop.Debug("Creating packed image",Contents);
	
	//	extract meta & non-meta
	let Meta = {};
	Meta.ImageMetas = [];
	let Images = [];
	
	function PushImage(Name,Image)
	{
		Images.push( Image );

		let ImageMeta = {};
		ImageMeta.Width = Image.GetWidth();
		ImageMeta.Height = Image.GetHeight();
		ImageMeta.Format = Image.GetFormat();
		ImageMeta.Name = Name;
		Meta.ImageMetas.push( ImageMeta );
	}
	
	function PushMeta(Name,Content)
	{
		Meta[Name] = Content;
	}
	
	function PushContent(Name)
	{
		const Content = Contents[Name];
		if ( !Content )
			return;
		if ( Content.constructor == Pop.Image )
			PushImage( Name, Content );
		else
			PushMeta( Name, Content );
	}
	const ContentKeys = Object.keys(Contents);
	ContentKeys.forEach( PushContent );
	
	//	encode meta into a line of pixels
	const MetaString = JSON.stringify(Meta);
	const MetaBytes = StringToBytes(MetaString);
	
	//	make image width the length of the byte array so row0 is always meta
	const PackedWidth = MetaBytes.length;
	const PackedChannels = 3;
	const PackedFormat = (PackedChannels==3) ? 'RGB' : 'RGBA';
	
	let Pixels = [];
	//	write meta
	Pixels.push( ...MetaBytes );
	//	write each image
	for ( let i=0;	i<Images.length;	i++ )
	{
		const Image = Images[i];
		const ImagePixels = Image.GetPixelBuffer();
		
		for ( let p=0;	p<ImagePixels.length;	p++ )
			Pixels.push( ImagePixels[p] );
		//	causing callstack error
		//const ImagePixelsArray = Array.from(ImagePixels);
		//Pixels.push( ...ImagePixelsArray );
	}
	
	//	pad with pattern we can read in a hex editor
	const PadBytes = StringToBytes('PAD!');
	const PackedStride = PackedWidth * PackedChannels;
	for ( let p=0;	p<PackedStride;	p++ )
	{
		//	no more padding needed
		if ( (Pixels.length % PackedStride) == 0 )
			break;
		Pixels.push( PadBytes[p%PadBytes.length] );
	}
	
	const PackedHeight = Pixels.length / PackedStride;
	if ( !Number.isInteger(PackedHeight) )
		throw "We didn't create aligned pixel buffer!";
	
	const PackedImage = new Pop.Image();
	Pixels = new Uint8Array(Pixels);
	PackedImage.WritePixels( PackedWidth, PackedHeight, Pixels, PackedFormat );
	return PackedImage;
}

function ConvertTextureBufferFile(Filename)
{
	const CachedFilename = GetCachedFilename(Filename,'texturebuffer.png');
	const Geo = LoadGeometryFile( Filename );
	const MaxPositons = 128*1024;
	const PositionFormat = 'RGBA';
	const ScaleToBounds = { Min:[0,0,0], Max:[1,1,1] };
	const TextureBuffers = LoadGeometryToTextureBuffers( Geo, MaxPositons, ScaleToBounds, PositionFormat );

	const PackedImage = CreatePackedImage(TextureBuffers);
	
	const WritePngBytes = function(PngBytes)
	{
		Pop.Debug("Writing PNG", CachedFilename);
		Pop.WriteToFile( CachedFilename, PngBytes );
		//Pop.ShowFileInFinder( CachedFilename );
	}
	ImageToPng( PackedImage, WritePngBytes );

}


//	convert some assets

const GeoFiles =
[
 	'Logo/Logo.svg.json',
];
for ( let i=1;	i<=96;	i++ )
{
	let Filename = 'Ocean/ocean_pts.' + (''+i).padStart(4,'0');
	Filename += '.ply';
	GeoFiles.push(Filename);
}

const SceneFiles =
[
 'CameraSpline.dae.json'
 ];

const TextureBufferFiles =
[
];
TextureBufferFiles.push( ...GetAnimalAssetFilenames() );

Pop.Debug( TextureBufferFiles );

TextureBufferFiles.forEach( ConvertTextureBufferFile );
SceneFiles.forEach( ConvertSceneFile );
GeoFiles.forEach( ConvertGeometryFile );
