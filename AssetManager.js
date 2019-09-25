//Pop.Include('AssetImport.js');
Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopMath.js');


//	some globals
Pop.AssetSync = {};
Pop.AssetSync.DefaultPort = 9000;
Pop.AssetSync.Command = {};
Pop.AssetSync.Command.OnAssetChanged = 'OnAssetChanged';
Pop.AssetSync.Command.OnAssetContent = 'OnAssetContent';


Pop.AssetServer = function(Port=Pop.AssetSync.DefaultPort)
{
	//	gr: replace with async system!
	this.Socket = null;

	this.OnMessage = function(Message)
	{
		if ( typeof Message == 'string' )
			Pop.Debug("Asset server got message", Message );
		else
			Pop.Debug("Asset server got binary message", Message, "x" + Message.length +"bytes" );
	}
	
	//	notify clients that an asset has changed
	this.OnAssetChanged = function(Filename)
	{
		const Message = {};
		Message.Type = Pop.AssetSync.Command.OnAssetChanged;
		Message.Filenames = [Filename];
		const MessageJson = JSON.stringify(Message);

		//	send to all peers
		function Send(Peer)
		{
			this.Socket.Send( Peer, MessageJson );
		}
		const Peers = this.Socket.GetPeers();
		Peers.forEach( Send.bind(this) );
	}

	this.Socket = new Pop.Websocket.Server(Port);
	Pop.Debug("Opened asset server",this.Socket.GetAddress());
	this.Socket.OnMessage = this.OnMessage.bind(this);
}

Pop.AssetClient = function(ServerAddress='localhost:'+Pop.AssetSync.DefaultPort)
{
	//	gr: I made this async for bluetooth, so we should do the same
	this.Loop = async function()
	{
		while ( true )
		{
			try
			{
				const Socket = await Pop.Websocket.Connect(ServerAddress);
				await this.SocketLoop(Socket);
			}
			catch (e)
			{
				Pop.Debug("Socket error",e,"Waiting 5 secs to reconnect");
				await Pop.Yield(5000);
			}
		}
	}
	
	this.SocketLoop = async function(Socket)
	{
		while ( true )
		{
			//	wait for command
			const NewCommandJson = await Socket.WaitForMessage();
			Pop.Debug("Got websocket command",NewCommandJson);
			
			//	first message should be JSON
			//	this should either be "something's changed", or "there's an asset comming"
			const NewCommand = JSON.parse( NewCommandJson );
			
			
			//	mark some assets as dirty and fetch if they've been loaded
			//	otherwise change file-fetcher to come from here
			if ( NewCommand.Command == Pop.AssetSync.OnAssetChanged )
			{
				Pop.Debug("Asset changed");
				continue;
			}
			
			//	new asset data incoming
			if ( NewCommand.Command == Pop.AssetSync.OnAssetContent )
			{
				const NewAssetContet = await Socket.WaitForMessage();
				//	replace filesystem/cache content with this message's contentt
				continue;
			}
			
			throw "Unhandled asset system command; " + NewCommand.Command;
		}
	}
	
	this.OnError = function(Error)
	{
		Pop.Debug("Pop.AssetClient error",Error);
	}
	
	//	should never really end
	this.Loop().then(Pop.Debug).catch(this.OnError.bind(this));
}

//	todo: AssetWatch which has a platform.filewatch to reload assets when they change
//			that then notifies Pop.AssetServer to tell clients they can get a new asset
//			they can fetch assets if any are in use
var AssetServer = null;
var AssetClient = null;

try
{
	AssetServer = new Pop.AssetServer();
}
catch(e)
{
	Pop.Debug("Failed to create asset server",e,"Creating client...");
	AssetClient = new Pop.AssetClient();
}

function OnAssetChanged(Filename)
{
	if ( AssetServer )
	{
		AssetServer.OnAssetChanged( Filename );
	}
}



//	gr: should change this to specific noise algos
//	this creates with normalised xyz around 0.5,0.5,0.5
function CreateRandomSphereImage(Width,Height)
{
	let Channels = 4;
	let Format = 'Float4';
	
	let Pixels = new Float32Array( Width * Height * Channels );
	for ( let i=0;	i<Pixels.length;	i+=4 )
	{
		let xyz = [ Math.random()-0.5, Math.random()-0.5, Math.random()-0.5 ];
		xyz = Math.Normalise3( xyz );
		xyz = Math.Add3( xyz, [1,1,1] );
		xyz = Math.Multiply3( xyz, [0.5,0.5,0.5] );
		
		let w = Math.random();
		Pixels[i+0] = xyz[0];
		Pixels[i+1] = xyz[1];
		Pixels[i+2] = xyz[2];
		Pixels[i+3] = w;
	}
	
	let Texture = new Pop.Image();
	Texture.WritePixels( Width, Height, Pixels, Format );
	return Texture;
}

const RandomTexture = CreateRandomSphereImage( 1024, 1024 );




function GetQuadGeometry(RenderTarget)
{
	let VertexSize = 2;
	let l = 0;
	let t = 0;
	let r = 1;
	let b = 1;
	//let VertexData = [	l,t,	r,t,	r,b,	l,b	];
	let VertexData = [	l,t,	r,t,	r,b,	r,b, l,b, l,t	];
	let TriangleIndexes = [0,1,2,	2,3,0];
	
	const VertexAttributeName = "TexCoord";
	
	//	emulate webgl on desktop
	TriangleIndexes = undefined;
	
	let QuadGeometry = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return QuadGeometry;
}


var AutoTriangleIndexes = [];
function GetAutoTriangleIndexes(IndexCount)
{
	let OldLength = AutoTriangleIndexes.length;
	while ( AutoTriangleIndexes.length < IndexCount )
		AutoTriangleIndexes.push( AutoTriangleIndexes.length );
	if ( OldLength != AutoTriangleIndexes.length )
		Pop.Debug("New AutoTriangleIndexes.length", AutoTriangleIndexes.length);
	
	//	slice so we don't modify our array, but still the length desired
	//	slow?
	return AutoTriangleIndexes.slice( 0, IndexCount );
	/*
	 Pop.Debug("auto gen triangles",TriangleCount);
	 GeometryAsset.TriangleIndexes = new Int32Array( TriangleCount );
	 for ( let t=0;	t<TriangleCount;	t++ )
	 GeometryAsset.TriangleIndexes[t] = t;
	 */
	
}

var Auto_auto_vt_Buffer = [];
function GetAuto_AutoVtBuffer(TriangleCount)
{
	const VertexSize = 2;
	const IndexCount = VertexSize * TriangleCount * 3;
	while ( Auto_auto_vt_Buffer.length < IndexCount )
	{
		let t = Auto_auto_vt_Buffer.length / VertexSize / 3;
		for ( let v=0;	v<3;	v++ )
		{
			let Index = t * 3;
			Index += v;
			Index *= VertexSize;
			Auto_auto_vt_Buffer[Index+0] = v;
			Auto_auto_vt_Buffer[Index+1] = t;
		}
	}
	//Pop.Debug('Auto_auto_vt_Buffer',Auto_auto_vt_Buffer);
	return new Float32Array( Auto_auto_vt_Buffer, 0, IndexCount );
}

function CreateCubeGeometry(RenderTarget,Min=-1,Max=1)
{
	let VertexSize = 3;
	let VertexData = [];
	let TriangleIndexes = [];
	
	let AddTriangle = function(a,b,c)
	{
		let FirstTriangleIndex = VertexData.length / VertexSize;
		
		a.forEach( v => VertexData.push(v) );
		b.forEach( v => VertexData.push(v) );
		c.forEach( v => VertexData.push(v) );
		
		TriangleIndexes.push( FirstTriangleIndex+0 );
		TriangleIndexes.push( FirstTriangleIndex+1 );
		TriangleIndexes.push( FirstTriangleIndex+2 );
	}
	
	let tln = [Min,Min,Min];
	let trn = [Max,Min,Min];
	let brn = [Max,Max,Min];
	let bln = [Min,Max,Min];
	let tlf = [Min,Min,Max];
	let trf = [Max,Min,Max];
	let brf = [Max,Max,Max];
	let blf = [Min,Max,Max];
	
	
	//	near
	AddTriangle( tln, trn, brn );
	AddTriangle( brn, bln, tln );
	//	far
	AddTriangle( trf, tlf, blf );
	AddTriangle( blf, brf, trf );
	
	//	top
	AddTriangle( tln, tlf, trf );
	AddTriangle( trf, trn, tln );
	//	bottom
	AddTriangle( bln, blf, brf );
	AddTriangle( brf, brn, bln );
	
	//	left
	AddTriangle( tlf, tln, bln );
	AddTriangle( bln, blf, tlf );
	//	right
	AddTriangle( trn, trf, brf );
	AddTriangle( brf, brn, trn );
	
	const VertexAttributeName = "LocalPosition";
	
	//	loads much faster as a typed array
	VertexData = new Float32Array( VertexData );
	TriangleIndexes = new Int32Array(TriangleIndexes);

	//	emulate webgl on desktop
	TriangleIndexes = undefined;

	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return TriangleBuffer;
}



var Assets = [];
var AssetFetchFunctions = [];
AssetFetchFunctions['Cube'] = CreateCubeGeometry;
AssetFetchFunctions['Quad'] = GetQuadGeometry;
AssetFetchFunctions['SmallCube'] = function(rt)	{	return CreateCubeGeometry(rt,-0.1,0.1);	};
AssetFetchFunctions['Cube01'] = function(rt)	{	return CreateCubeGeometry(rt,0,1);	};


function GetAsset(Name,RenderContext)
{
	let ContextKey = GetUniqueHash( RenderContext );
	if ( !Assets.hasOwnProperty(ContextKey) )
		Assets[ContextKey] = [];
	
	let ContextAssets = Assets[ContextKey];
	
	if ( ContextAssets.hasOwnProperty(Name) )
		return ContextAssets[Name];
	
	if ( !AssetFetchFunctions.hasOwnProperty(Name) )
		throw "No known asset named "+ Name;
	
	ContextAssets[Name] = AssetFetchFunctions[Name]( RenderContext );
	OnAssetChanged( Name );
	return ContextAssets[Name];
}



var Auto_auto_vt_Buffer = [];
function GetAuto_AutoVtBuffer(TriangleCount)
{
	const VertexSize = 2;
	const IndexCount = VertexSize * TriangleCount * 3;
	while ( Auto_auto_vt_Buffer.length < IndexCount )
	{
		let t = Auto_auto_vt_Buffer.length / VertexSize / 3;
		for ( let v=0;	v<3;	v++ )
		{
			let Index = t * 3;
			Index += v;
			Index *= VertexSize;
			Auto_auto_vt_Buffer[Index+0] = v;
			Auto_auto_vt_Buffer[Index+1] = t;
		}
	}
	//Pop.Debug('Auto_auto_vt_Buffer',Auto_auto_vt_Buffer);
	return new Float32Array( Auto_auto_vt_Buffer, 0, IndexCount );
}



function GetAutoTriangleMesh(RenderTarget,TriangleCount)
{
	Pop.Debug('GetAutoTriangleMesh');
	
	//	vertex stuff
	//	we should get these from geo for assets WITH a vertex buffer
	let VertexSize = 2;
	let VertexAttributeName = 'Vertex';

	let VertexBuffer = GetAuto_AutoVtBuffer(TriangleCount);
	
	const IndexCount = TriangleCount * 3;
	let TriangleIndexes = GetAutoTriangleIndexes( IndexCount );
	
	//	loads much faster as a typed array
	VertexBuffer = new Float32Array( VertexBuffer );
	TriangleIndexes = new Int32Array( TriangleIndexes );
	
	//	emulate webgl on desktop
	TriangleIndexes = undefined;

	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexBuffer, VertexSize, TriangleIndexes );
	
	return TriangleBuffer;
}


function LoadPointMeshFromFile(RenderTarget,Filename,GetIndexMap,ScaleToBounds)
{
	const CachedFilename = GetCachedFilename(Filename,'geometry');
	if ( Pop.FileExists(CachedFilename) )
		Filename = CachedFilename;
	
	//	load positions, colours
	const Geo = LoadGeometryFile( Filename );
	
	//	mesh stuff
	let PositionSize = Geo.PositionSize;
	let Positions = Geo.Positions;
	let Colours = Geo.Colours;
	let ColourSize = Colours ? 3 : null;
	let Alphas = Geo.Alphas;
	let AlphaSize = Alphas ? 1 : null;

	//	vertex stuff
	//	we should get these from geo for assets WITH a vertex buffer
	let VertexBuffer = 'auto_vt';
	let VertexSize = 2;
	let VertexAttributeName = 'Vertex';
	let TriangleIndexes = 'auto';
	
	//	scale positions
	if ( ScaleToBounds && Positions )
	{
		Pop.Debug("Scaling to ",ScaleToBounds);
		const PositionCount = Positions.length / PositionSize;
		for ( let p=0;	p<PositionCount;	p++ )
		{
			for ( let v=0;	v<PositionSize;	v++ )
			{
				let i = (p * PositionSize)+v;
				let f = Positions[i];
				f = Math.lerp( ScaleToBounds.Min[v], ScaleToBounds.Max[v], f );
				Positions[i] = f;
			}
		}
		
		//	scale up the geo bounding box
		Geo.BoundingBox.Min = Geo.BoundingBox.Min.slice();
		Geo.BoundingBox.Max = Geo.BoundingBox.Max.slice();
		for ( let i=0;	i<3;	i++ )
		{
			Geo.BoundingBox.Min[i] = Math.lerp( ScaleToBounds.Min[i], ScaleToBounds.Max[i], Geo.BoundingBox.Min[i] );
			Geo.BoundingBox.Max[i] = Math.lerp( ScaleToBounds.Min[i], ScaleToBounds.Max[i], Geo.BoundingBox.Max[i] );
		}
	}
	
	const AlphaIsPositionW = true;
	if ( AlphaIsPositionW && Alphas && PositionSize < 4 )
	{
		Pop.Debug(Filename,"Pushing position W as alpha");
		let NewPositions = [];
		for ( let i=0;	i<Positions.length/PositionSize;	i++ )
		{
			let p = i * PositionSize;
			for ( let c=0;	c<PositionSize;	c++ )
			{
				let x = Positions[p+c];
				NewPositions.push(x);
			}
			let a = Alphas[i];
			NewPositions.push(a);
		}
		
		//	positions now 4!
		Positions = NewPositions;
		PositionSize++;
		Alphas = null;
		AlphaSize = null;
	}
	
	//	sort, but consistently
	//	we used to sort for depth, but dont need to any more
	if ( GetIndexMap )
	{
		/*
		let Map = GetIndexMap(Positions);
		let NewPositions = [];
		Map.forEach( i => NewPositions.push(Positions[i]) );
		Positions = NewPositions;
		*/
	}
	
	let PositionImage = new Pop.Image();
	if ( PositionImage )
	{
		//	pad to square
		const Channels = PositionSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Positions.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Position texture",Width,Height,Channels,"Total",PixelDataSize);
		
		const PixelValues = Positions.slice();
		PixelValues.length = PixelDataSize;
		
		const Pixels = new Float32Array( PixelValues );
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;
		
		const PixelFormat = 'Float'+Channels;
		PositionImage.WritePixels( Width, Height, Pixels, PixelFormat );
	}
	
	let ColourImage = null;
	if ( Colours )
	{
		ColourImage = new Pop.Image();
		
		if ( Colours.length / ColourSize != Positions.length / PositionSize )
			throw "Expecting Colours.length ("+Colours.length+") to match Positions.length ("+Positions.length+")";
		//	pad to square
		const Channels = ColourSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Colours.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Colours texture",Width,Height,Channels,"Total",PixelDataSize);

		const PixelValues = Colours.slice();
		PixelValues.length = PixelDataSize;
		
		const Pixels = new Float32Array( PixelValues );
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;

		const PixelFormat = 'Float'+Channels;
		ColourImage.WritePixels( Width, Height, Pixels, PixelFormat );
	}
	
	let AlphaImage = null;
	if ( Alphas )
	{
		AlphaImage = new Pop.Image();
		
		if ( Alphas.length/AlphaSize != Positions.length/PositionSize )
			throw "Expecting Alphas.length ("+Alphas.length+") to match Positions.length ("+Positions.length+")";
		//	pad to square
		const Channels = AlphaSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Alphas.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Alphas texture",Width,Height,Channels,"Total",PixelDataSize);

		const PixelValues = Alphas.slice();
		PixelValues.length = PixelDataSize;
		
		const Pixels = new Float32Array( PixelValues );
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;

		const PixelFormat = 'Float'+Channels;
		AlphaImage.WritePixels( Width, Height, Pixels, PixelFormat );
	}

	//	auto generated vertexes
	if ( VertexBuffer == 'auto_vt' )
	{
		//Pop.Debug("Auto generating vertex buffer ", GeometryAsset.VertexBuffer);
		if ( VertexSize != 2 )
			throw "Expected vertex size of 2 (not " + VertexSize + ") for " + VertexBuffer;
		
		//	need to work out triangle count...
		const TriangleCount = Positions.length;
		VertexBuffer = GetAuto_AutoVtBuffer(TriangleCount);
	}
	
	//	auto generated triangles
	if ( TriangleIndexes == 'auto' )
	{
		const IndexCount = VertexBuffer.length / VertexSize;
		TriangleIndexes = GetAutoTriangleIndexes( IndexCount );
	}
	
	//	loads much faster as a typed array
	VertexBuffer = new Float32Array( VertexBuffer );
	TriangleIndexes = new Int32Array( TriangleIndexes );
	
	//	emulate webgl on desktop
	TriangleIndexes = undefined;

	
	//let CreateBufferTime = Pop.GetTimeNowMs();
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexBuffer, VertexSize, TriangleIndexes );
	//Pop.Debug("Making triangle buffer took", Pop.GetTimeNowMs()-CreateBufferTime);
	
	TriangleBuffer.BoundingBox = Geo.BoundingBox;
	TriangleBuffer.PositionTexture = PositionImage;
	TriangleBuffer.ColourTexture = ColourImage;
	TriangleBuffer.AlphaTexture = AlphaImage;

	return TriangleBuffer;
}



