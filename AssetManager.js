Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopMath.js');

const EnableAssetSync = Pop.GetExeArguments().includes('AssetSync') || Pop.GetExeArguments().includes('AssetServer');

//	some globals
Pop.AssetSync = {};
Pop.AssetSync.DefaultPorts = [9000,9001,9002,9003,9004];
Pop.AssetSync.Command = {};
Pop.AssetSync.Command.OnAssetChanged = 'OnAssetChanged';
Pop.AssetSync.Command.GetAssetContent = 'GetAssetContent';
Pop.AssetSync.Command.OnAssetContent = 'OnAssetContent';

//	for shaders (later more files?) multiple-filenames => asset name need to be identifiable/split/joined but we
//	need to distinguish them from valid filename chars. Not much in unix/osx is invalid...
const AssetFilenameJoinString = ':';


Pop.AssetServer = function(Port=Pop.AssetSync.DefaultPorts[0])
{
	//	gr: replace with async system!
	this.Socket = null;

	this.OnMessage = function(Message,Peer)
	{
		if ( typeof Message != 'string' )
		{
			Pop.Debug("unhandled Asset server binary message", Message, "x" + Message.length +"bytes" );
			return;
		}
		
		//	assume command
		const Command = JSON.parse(Message);
		if ( !Command.Filename || !Command.Command )
			throw "Asset server got invalid command;"+Message;
		
		if ( Command.Command == Pop.AssetSync.Command.GetAssetContent )
		{
			this.SendAssetToPeer( Command.Filename, Peer );
			return;
		}
		
		throw "Unhandled Asset server message " + Message;
	}
	
	this.SendAssetToPeer = function(Filename,Peer)
	{
		//	is this file text or binary... maybe need to deal with that other side?
		const Contents = Pop.LoadFileAsArrayBuffer( Filename );
		const Command = {};
		Command.Command = Pop.AssetSync.Command.OnAssetContent;
		Command.Filename = Filename;
		const CommandJson = JSON.stringify( Command );
		
		//	need to send messages explicitly one after another...
		//	adapt api? (send array) or make a queue?
		this.Socket.Send( Peer, CommandJson );
		this.Socket.Send( Peer, Contents );
	}
	
	//	notify clients that an asset has changed
	this.OnAssetChanged = function(Filename)
	{
		const Message = {};
		Message.Command = Pop.AssetSync.Command.OnAssetChanged;
		Message.Filenames = [Filename];
		const MessageJson = JSON.stringify(Message);

		//	send to all peers
		function Send(Peer)
		{
			this.Socket.Send( Peer, MessageJson );
		}
		const Peers = this.Socket.GetPeers();
		Pop.Debug("Notifying peers of asset change",Peers,MessageJson);
		Peers.forEach( Send.bind(this) );
	}

	this.Socket = new Pop.Websocket.Server(Port);
	Pop.Debug("Opened asset server",this.Socket.GetAddress());
	this.Socket.OnMessage = this.OnMessage.bind(this);
}

Pop.AssetClient = function(Hostname='localhost',Ports=Pop.AssetSync.DefaultPorts[0])
{
	//	gr: I made this async for bluetooth, so we should do the same
	this.Loop = async function()
	{
		let PortIndex = 0;
		while ( true )
		{
			const Port = Ports[PortIndex%Ports.length];
			const ServerAddress = Hostname + ':' + Port;
			try
			{
				const Socket = await Pop.Websocket.Connect(ServerAddress);
				Pop.Debug("Connected to asset server",ServerAddress);
				await this.SocketLoop(Socket);
			}
			catch (e)
			{
				Pop.Debug("Socket error connecting to " + ServerAddress,e,"Waiting 1 secs to reconnect");
				await Pop.Yield(1000);
				PortIndex++;
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
			if ( NewCommand.Command == Pop.AssetSync.Command.OnAssetChanged )
			{
				function Load(Filename)
				{
					this.OnRemoteAssetChanged( Filename, Socket );
				}
				NewCommand.Filenames.forEach( Load.bind(this) );
				continue;
			}
			
			//	new asset data incoming
			if ( NewCommand.Command == Pop.AssetSync.Command.OnAssetContent )
			{
				const NewAssetContent = await Socket.WaitForMessage();
				//	replace filesystem/cache content with this message's content
				this.OnRemoteAssetContent( NewCommand.Filename, NewAssetContent );
				continue;
			}
			
			throw "Unhandled asset system command; " + NewCommand.Command;
		}
	}
	
	this.OnError = function(Error)
	{
		Pop.Debug("Pop.AssetClient error",Error);
	}
	
	this.OnRemoteAssetChanged = function(Filename,Socket)
	{
		//	current system:
		//	request new file, when it comes, update the file system, THEN invalidate
		const Command = {};
		Command.Filename = Filename;
		Command.Command = Pop.AssetSync.Command.GetAssetContent;
		const CommandJson = JSON.stringify( Command );

		Pop.Debug("Requesting new asset contents",CommandJson);
		Socket.Send( CommandJson );
	}
	
	this.OnRemoteAssetContent = function(Filename,Contents)
	{
		Pop.Debug("Got new asset content",Filename,Contents);
		//	current system
		//	request new file, when it comes, update the file system cache, THEN invalidate
		//	this only applies to web API... need a better intermediate layer for others
		Pop.Debug("Updating web file cache");
		if ( !Pop._AssetCache )
			throw "No Pop._AssetCache currently this is web-only";
		Pop._AssetCache[Filename] = Contents;
		
		//	now invalidate local asset cache
		InvalidateAsset(Filename);
	}
	
	//	should never really end
	this.Loop().then(Pop.Debug).catch(this.OnError.bind(this));
}


//	try multiple ports
function CreateAssetServer()
{
	let Error = "Failed to create asset server";
	const Ports = Pop.AssetSync.DefaultPorts;
	for ( let i=0;	i<Ports.length;	i++ )
	{
		const Port = Ports[i];
		try
		{
			const Server = new Pop.AssetServer(Port);
			Pop.Debug("Opened asset server",Port);
			return Server;
		}
		catch(e)
		{
			Error = e;
		}
	}
	
	throw Error;
}

//	todo: AssetWatch which has a platform.filewatch to reload assets when they change
//			that then notifies Pop.AssetServer to tell clients they can get a new asset
//			they can fetch assets if any are in use
var AssetServer = null;
var AssetClient = null;

if ( EnableAssetSync )
{
	try
	{
		AssetServer = CreateAssetServer();
	}
	catch(e)
	{
		Pop.Debug("Failed to create asset server",e,"Creating client...");
		AssetClient = new Pop.AssetClient('localhost',Pop.AssetSync.DefaultPorts);
	}
}

const FileMonitors = {};

function OnFileChanged(Filename)
{
	//	report to client
	if ( AssetServer )
	{
		Pop.Debug("AssetServer.OnAssetChanged",Filename);
		AssetServer.OnAssetChanged( Filename );
	}
	
	//	invalidate local
	InvalidateAsset(Filename);
}

function MonitorAssetFile(Filename)
{
	//	not supported
	if ( !Pop.FileMonitor )
	{
		//Pop.Debug("Pop.FileMonitor not supported");
		return;
	}
	
	//	todo: should each watch be a promise and we just recreate it
	//		when we've handled a change?
	//	already have a watch
	if ( FileMonitors.hasOwnProperty(Filename) )
	{
		Pop.Debug("Already watching",Filename);
		return;
	}
	
	//	create a new one
	const Monitor = new Pop.FileMonitor( Filename );
	Monitor.OnChanged = function()	{	OnFileChanged(Filename);	};
	FileMonitors[Filename] = Monitor;
	Pop.Debug("Now monitoring",Filename);
}

Pop.AssetManager = function()
{
	this.AssetChangedPromises = {};
	
	//	re-work this so it's a general async load
	this.WaitForAssetChange = async function(Filename)
	{
		if ( !this.AssetChangedPromises.hasOwnProperty(Filename) )
			this.AssetChangedPromises[Filename] = new Pop.PromiseQueue();
		const Queue = this.AssetChangedPromises[Filename];
		return Queue.Allocate();
	}
	
	this.OnAssetChanged = function(Filename)
	{
		//	trigger promise queues
		//	no queue
		if ( !this.AssetChangedPromises.hasOwnProperty(Filename) )
			return;
		const Queue = this.AssetChangedPromises[Filename];
		Queue.Resolve();
	}
}

function OnAssetChanged(Filename)
{
	//	relay to clients if an asset changes
	if ( AssetServer )
	{
		AssetServer.OnAssetChanged( Filename );
	}
	
	//	watch for file changes
	MonitorAssetFile( Filename );
	
	//	external watchers
	AssetManager.OnAssetChanged( Filename );
}



//	gr: should change this to specific noise algos
//	this creates with normalised xyz around 0.5,0.5,0.5
function CreateRandomSphereImage(Width,Height)
{
	let Channels = 4;
	let Format = 'Float4';

	const TimerStart = Pop.GetTimeNowMs();
	
	let Pixels = new Float32Array( Width * Height * Channels );
	const Rands = GetRandomNumberArray(Pixels.length*Channels);
	for ( let i=0;	i<Pixels.length;	i+=Channels )
	{
		let xyz = Rands.slice( i*Channels, (i*Channels)+Channels );
		let w = xyz[3];
		xyz = Math.Subtract3( xyz, [0.5,0.5,0.5] );
		xyz = Math.Normalise3( xyz );
		xyz = Math.Add3( xyz, [1,1,1] );
		xyz = Math.Multiply3( xyz, [0.5,0.5,0.5] );
		
		Pixels[i+0] = xyz[0];
		Pixels[i+1] = xyz[1];
		Pixels[i+2] = xyz[2];
		Pixels[i+3] = w;
	}
	
	Pop.Debug("CreateRandomSphereImage() took", Pop.GetTimeNowMs() - TimerStart);
	
	let Texture = new Pop.Image();
	Texture.WritePixels( Width, Height, Pixels, Format );
	return Texture;
}

Pop.Debug("RandomTexture = CreateRandomSphereImage");
const RandomTexture = CreateRandomSphereImage( 1024, 1024 );
const BlackTexture = Pop.CreateColourTexture( [0,0,0,1] );
const ZeroOffsetTexture = Pop.CreateColourTexture( [0.5,0.5,0.5,1] );



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
	const LocalPositions =
	[
		[-1,-1],
	 	[1,-1],
	 	[0,1]
	];
	const VertexSize = 3;
	const IndexCount = VertexSize * TriangleCount * 3;
	while ( Auto_auto_vt_Buffer.length < IndexCount )
	{
		let t = Auto_auto_vt_Buffer.length / VertexSize / 3;
		for ( let v=0;	v<3;	v++ )
		{
			let Index = t * 3;
			Index += v;
			Index *= VertexSize;
			Auto_auto_vt_Buffer[Index+0] = LocalPositions[v][0];
			Auto_auto_vt_Buffer[Index+1] = LocalPositions[v][1];
			if ( VertexSize >= 3 )
				Auto_auto_vt_Buffer[Index+2] = t;
			if ( VertexSize >= 4 )
				Auto_auto_vt_Buffer[Index+3] = v;
		}
	}
	//Pop.Debug('Auto_auto_vt_Buffer',Auto_auto_vt_Buffer);
	let Array = new Float32Array( Auto_auto_vt_Buffer, 0, IndexCount );
	Array.VertexSize = VertexSize;
	return Array;
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



var Assets = {};
var AssetFetchFunctions = {};
var AssetManager = new Pop.AssetManager();

AssetFetchFunctions['Cube'] = CreateCubeGeometry;
AssetFetchFunctions['Quad'] = GetQuadGeometry;
AssetFetchFunctions['SmallCube'] = function(rt)	{	return CreateCubeGeometry(rt,-0.1,0.1);	};
AssetFetchFunctions['Cube01'] = function(rt)	{	return CreateCubeGeometry(rt,0,1);	};


function InvalidateAsset(Filename)
{
	Pop.Debug("InvalidateAsset",Filename);
	function InvalidateAssetInContext(Context)
	{
		const ContextKey = GetUniqueHash( Context );
		const ContextAssets = Assets[ContextKey];
		
		//	gr: cope with assetnames containing multiple filenames
		function ShouldInvalidateKey(AssetName)
		{
			const Filenames = AssetName.split(AssetFilenameJoinString);
			const AnyMatches = Filenames.some( f => f == Filename );
			return AnyMatches;
		}
		
		const InvalidateKeys = Object.keys( ContextAssets ).filter( ShouldInvalidateKey );
		if ( !InvalidateKeys.length )
		{
			Pop.Debug("Context",Context," has no matching assets for ",Filename,Object.keys(ContextAssets));
			return;
		}
		
		function InvalidateKey(AssetName)
		{
			//	delete existing asset
			delete ContextAssets[AssetName];
			Pop.Debug("Invalidated ",AssetName,"on",Context);
		}
		InvalidateKeys.forEach( InvalidateKey );
	}
	const AssetContexts = Object.keys(Assets);
	AssetContexts.forEach( InvalidateAssetInContext );
}

function GetAsset(Name,RenderContext)
{
	let ContextKey = GetUniqueHash( RenderContext );
	if ( !Assets.hasOwnProperty(ContextKey) )
		Assets[ContextKey] = {};
	
	let ContextAssets = Assets[ContextKey];
	
	if ( ContextAssets.hasOwnProperty(Name) )
		return ContextAssets[Name];
	
	if ( !AssetFetchFunctions.hasOwnProperty(Name) )
		throw "No known asset named "+ Name;
	
	Pop.Debug("Generating asset "+Name+"...");
	const Timer_Start = Pop.GetTimeNowMs();
	ContextAssets[Name] = AssetFetchFunctions[Name]( RenderContext );
	const Timer_Duration = Math.floor(Pop.GetTimeNowMs() - Timer_Start);
	Pop.Debug("Generating asset "+Name+" took "+Timer_Duration + "ms");
	OnAssetChanged( Name );
	return ContextAssets[Name];
}

function GetAutoTriangleMesh(RenderTarget,TriangleCount)
{
	Pop.Debug('GetAutoTriangleMesh');
	
	//	vertex stuff
	//	we should get these from geo for assets WITH a vertex buffer
	let VertexAttributeName = 'LocalUv_TriangleIndex';

	let VertexBuffer = GetAuto_AutoVtBuffer(TriangleCount);
	VertexSize = VertexBuffer.VertexSize;
	
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
	Pop.Debug("LoadPointMeshFromFile",Filename);
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
		Pop.Debug("Scaling to ",JSON.stringify(ScaleToBounds) );
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


//	this returns the "asset name"
function RegisterShaderAssetFilename(FragFilename,VertFilename)
{
	function LoadAndCompileShader(RenderContext)
	{
		const FragShaderContents = Pop.LoadFileAsString(FragFilename);
		const VertShaderContents = Pop.LoadFileAsString(VertFilename);
		const Shader = Pop.GetShader( RenderContext, FragShaderContents, VertShaderContents );
		return Shader;
	}
	
	//	we use / as its not a valid filename char
	const AssetName = FragFilename+AssetFilenameJoinString+VertFilename;
	if ( AssetFetchFunctions.hasOwnProperty(AssetName) )
		throw "Shader asset name clash, need to change the name we use";
	AssetFetchFunctions[AssetName] = LoadAndCompileShader;
	return AssetName;
}
