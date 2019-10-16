
const AutoTriangleMeshCount = 256*512;	//	130k
const InvalidColour = [0,1,0];

//	setup global assets
AssetFetchFunctions['AutoTriangleMesh'] = function(RenderTarget)	{	return GetAutoTriangleMesh( RenderTarget, AutoTriangleMeshCount );	};







//	move this to TActor once everything derives from it
function GetActorWorldBoundingBox(Actor)
{
	const LocalTransform = Actor.GetLocalToWorldTransform();
	const Scale = Math.GetMatrixScale( LocalTransform );
	const BoundingBoxLocal = Actor.GetBoundingBox();
	const Position = Math.GetMatrixTranslation( LocalTransform );
	
	//	todo: we should mult without rotating, or rotate and then get new min/max
	const BoundingBoxWorld = {};
	BoundingBoxWorld.Min = Math.Multiply3( BoundingBoxLocal.Min, Scale );
	BoundingBoxWorld.Max = Math.Multiply3( BoundingBoxLocal.Max, Scale );
	
	BoundingBoxWorld.Min = Math.Add3( BoundingBoxWorld.Min, Position );
	BoundingBoxWorld.Max = Math.Add3( BoundingBoxWorld.Max, Position );
	
	return BoundingBoxWorld;
}

function GetActorWorldBoundingBoxCorners(BoundingBoxWorld,IncludeBothX=true,IncludeBothY=true,IncludeBothZ=true)
{
	const Corners = [];
	const Min = BoundingBoxWorld.Min;
	const Max = BoundingBoxWorld.Max;
	
	//	save some processing time by only including things we need
	if ( IncludeBothZ && !IncludeBothX && !IncludeBothY )
	{
		const Mid = Math.Lerp3( Min, Max, 0.5 );
		Corners.push( [Mid[0], Mid[1], Min[2]] );
		Corners.push( [Mid[0], Mid[1], Max[2]] );
		return Corners;
	}
	
	Corners.push( [Min[0], Min[1], Min[2]] );
	Corners.push( [Max[0], Min[1], Min[2]] );
	Corners.push( [Max[0], Max[1], Min[2]] );
	Corners.push( [Min[0], Max[1], Min[2]] );
	Corners.push( [Min[0], Min[1], Max[2]] );
	Corners.push( [Max[0], Min[1], Max[2]] );
	Corners.push( [Max[0], Max[1], Max[2]] );
	Corners.push( [Min[0], Max[1], Max[2]] );
	
	return Corners;
}

function GetIntersectingActors(Ray,Scene)
{
	const Intersections = [];
	
	function TestIntersecting(Actor)
	{
		if ( !IsActorSelectable(Actor) )
			return;
		
		const BoundingBox = GetActorWorldBoundingBox( Actor );
		const IntersectionPos = Math.GetIntersectionRayBox3( Ray.Start, Ray.Direction, BoundingBox.Min, BoundingBox.Max );
		if ( !IntersectionPos )
			return;
		
		let Intersection = {};
		Intersection.Position = IntersectionPos;
		Intersection.Actor = Actor;
		Intersections.push( Intersection );
	}
	Scene.forEach( TestIntersecting );
	
	return Intersections;
}



//	return the filter function
function GetCameraActorCullingFilter(Camera,Viewport)
{
	const CameraFrustumMatrix = Camera.GetWorldToFrustumTransform(Viewport);
	//	normalising doesn't seem to make much difference, but it should?
	const FrustumPlanes = Math.GetFrustumPlanes( CameraFrustumMatrix, false );
	
	const IsVisibleFunction = function(Actor)
	{
		const BoundingBox = GetActorWorldBoundingBox(Actor);
		return Math.IsBoundingBoxIntersectingFrustumPlanes( BoundingBox, FrustumPlanes );
	}
	return IsVisibleFunction;
	
/*
	//	get a matrix to convert world space to camera frustum space (-1..1)
	const WorldToFrustum = Camera.GetWorldToFrustumTransform(Viewport);
	
	const IsVisibleFunction = function(Actor)
	{
		const TestBounds = true;
		
		const IsWorldPositionVisible = function(WorldPosition)
		{
			//const WorldPosition = Math.GetMatrixTranslation( ActorTransform, true );
			const PosInWorldMtx = Math.CreateTranslationMatrix( ...WorldPosition );
			const PosInFrustumMtx = Math.MatrixMultiply4x4( WorldToFrustum,  PosInWorldMtx );
			const PosInFrustumPos = Math.GetMatrixTranslation(  PosInFrustumMtx, true );
			
			if ( Params.FrustumCullTestX && !Math.InsideMinusOneToOne( PosInFrustumPos[0] ) )	return false;
			if ( Params.FrustumCullTestY && !Math.InsideMinusOneToOne( PosInFrustumPos[1] ) )	return false;
			if ( Params.FrustumCullTestZ && !Math.InsideMinusOneToOne( PosInFrustumPos[2] ) )	return false;
			
			return true;
		}
		
		if ( TestBounds )
		{
			const WorldBounds = GetActorWorldBoundingBox( Actor );
			if ( Math.PositionInsideBoxXZ( Camera.Position, WorldBounds ) )
				return true;
			
			const WorldBoundsCorners = GetActorWorldBoundingBoxCorners( WorldBounds, Params.FrustumCullTestX, Params.FrustumCullTestY, Params.FrustumCullTestZ );
			return WorldBoundsCorners.some( IsWorldPositionVisible );
		}
		else
		{
			const ActorTransform = Actor.GetLocalToWorldTransform();
			const ActorPosition = Math.GetMatrixTranslation( ActorTransform );
			return IsWorldPositionVisible( ActorPosition );
		}
		
	}
	
	return IsVisibleFunction;
 */
}


function LoadAssetGeoTextureBuffer(RenderTarget,Filename,AddNoise=true)
{
	const MaxPositions = AutoTriangleMeshCount;
	
	function AddNoiseToPosition(xyz,Index,Bounds)
	{
		const Noise =
		[
		(Bounds.Max[0]-Bounds.Min[0]) * Params.LoadTextureBufferNoise * 0.5,
		(Bounds.Max[1]-Bounds.Min[1]) * Params.LoadTextureBufferNoise * 0.5,
		(Bounds.Max[2]-Bounds.Min[2]) * Params.LoadTextureBufferNoise * 0.5
		];
		function AddNoise(v,Index)
		{
			let Change = Math.lerp( -Noise[Index], Noise[Index], Math.random() );
			xyz[Index] = v + Change;
		}
		xyz.forEach(AddNoise);
	}
	
	//	load texture buffer formats
	const CachedTextureBufferFilename = GetCachedFilename(Filename,'texturebuffer.png');
	if ( Pop.FileExists(CachedTextureBufferFilename) )
	{
		const Contents = Pop.LoadFileAsImage(CachedTextureBufferFilename);
		const GeoTextureBuffers = LoadPackedImage( Contents, AddNoise ? AddNoiseToPosition : null );
		return GeoTextureBuffers;
	}
	
	const CachedGeoFilename = GetCachedFilename(Filename,'geometry');
	if ( Pop.FileExists(CachedGeoFilename) )
		Filename = CachedGeoFilename;
	
	//	load positions, colours
	const Geo = LoadGeometryFile( Filename );
	const GeoTextureBuffers = LoadGeometryToTextureBuffers( Geo, MaxPositions );
	return GeoTextureBuffers;
}

const FakeRenderTarget = {};

function SetupAnimalTextureBufferActor(Filename,GetMeta)
{
	const Meta = GetMeta(this);
	this.Geometry = 'AutoTriangleMesh';
	this.RenderShader = Meta.RenderShader;
	
	const AddNoise = Meta.AddNoiseToTextureBuffer!==false;
	{
		//	handle array for animation
		if ( Array.isArray(Filename) )
		{
			const LoadFrame = function(Filename)
			{
				AssetFetchFunctions[Filename] = function(RenderContext)
				{
					return LoadAssetGeoTextureBuffer( RenderContext, Filename, AddNoise );
				}
				const Buffers = GetAsset( Filename, FakeRenderTarget );
				
				//	set at least one to grab colours
				this.TextureBuffers = Buffers;
				this.PositionAnimationTextures.push( Buffers.PositionTexture );
			}
			this.PositionAnimationTextures = [];
			Filename.forEach( LoadFrame.bind(this) );
		}
		else
		{
			//	setup the fetch func on demand, if already cached, won't make a difference
			AssetFetchFunctions[Filename] = function(RenderContext)
			{
				return LoadAssetGeoTextureBuffer( RenderContext, Filename, AddNoise );
			};
			this.TextureBuffers = GetAsset( Filename, FakeRenderTarget );
		}
	}
	
	this.UpdateVelocityShader = Meta.VelocityShader;
	this.UpdatePositionShader = Meta.PositionShader;
	this.UpdatePhysics = false;
	this.UpdatePhysicsFirst = true;
	
	if ( Meta.FitToBoundingBox )
	{
		//	box is local space, but world size
		let BoxScale = Math.Subtract3( this.BoundingBox.Max, this.BoundingBox.Min );
		let Position = Math.GetMatrixTranslation( this.LocalToWorldTransform );
		//	points are 0-1 so we need to move our offset (and bounds)
		let BoxOffset = Math.Multiply3( BoxScale, [0.5,0.5,0.5] );
		Position = Math.Subtract3( Position, BoxOffset );
		let Scale = BoxScale;
		this.LocalToWorldTransform = Math.CreateTranslationScaleMatrix( Position, Scale );
		//	bounds match mesh!
		this.BoundingBox.Min = [0,0,0];
		this.BoundingBox.Max = [1,1,1];
		Pop.Debug("Fit bounding box transform",this.LocalToWorldTransform,this);
	}
	else
	{
		//	update bounding box to use geo
		if ( this.TextureBuffers.BoundingBox )
			this.BoundingBox = this.TextureBuffers.BoundingBox;
	}
	
	
	
	this.GetPositionTexture = function(Time)
	{
		//	is animation
		if ( this.PositionAnimationTextures )
		{
			let FrameDuration = 1 / Params.OceanAnimationFrameRate;
			let AnimDuration = this.PositionAnimationTextures.length * FrameDuration;
			let NormalisedTime = (Time % AnimDuration) / AnimDuration;
			let FrameIndex = Math.floor( NormalisedTime * this.PositionAnimationTextures.length );
			//Pop.Debug("FrameIndex",FrameIndex,this.PositionAnimationTextures.length);
			return this.PositionAnimationTextures[FrameIndex];
		}
		
		//	position texture is copy from original source
		if ( this.PositionTexture )
			return this.PositionTexture;
		
		return this.TextureBuffers.PositionTexture;
	}
	
	this.ResetPhysicsTextures = function()
	{
		if ( !this.TextureBuffers )
			throw "Not ready to setup physics yet, no texture buffers";
		
		//	make copy of original reference!
		Pop.Debug("Copy original position texture");
		this.PositionTexture = new Pop.Image();
		this.PositionTexture.Copy( this.TextureBuffers.PositionTexture );
		//Pop.Debug("ResetPhysicsTextures", JSON.stringify(this) );
		//	need to init these to zero?
		let Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		const Format = this.PositionTexture.GetFormat();
		this.VelocityTexture = new Pop.Image(Size,Format);
		this.ScratchVelocityTexture = new Pop.Image(Size,Format);
		this.ScratchPositionTexture = new Pop.Image(Size,Format);
		//this.PositionOrigTexture = new Pop.Image();
		this.PositionOrigTexture = this.TextureBuffers.PositionTexture;
		//this.PositionOrigTexture.Copy( this.PositionTexture );
	
		this.ScratchVelocityTexture.Copy( this.VelocityTexture );
		this.ScratchPositionTexture.Copy( this.PositionTexture );
		this.UpdatePhysicsFirst = true;
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
		if ( !this.UpdatePhysics )
			return;
		
		//	has no physics!
		if ( !this.UpdatePositionShader )
			return;
		
		if ( !this.VelocityTexture )
		{
			this.ResetPhysicsTextures();
		}
		
		const Meta = GetMeta(this);
		const TriangleCount = this.TextureBuffers.TriangleCount;
		const FirstUpdate = this.UpdatePhysicsFirst;
		this.UpdatePhysicsFirst = false;
		const SetAnimalPhysicsUniforms = function(Shader)
		{
			SetPhysicsUniforms(Shader);
			
			function ApplyUniform(UniformName)
			{
				const Value = Meta.PhysicsUniforms[UniformName];
				Shader.SetUniform( UniformName, Value );
			}
			Object.keys( Meta.PhysicsUniforms ).forEach( ApplyUniform );
			
			if ( FirstUpdate )
				Pop.Debug("Physics first update");
			Shader.SetUniform('FirstUpdate', FirstUpdate );
			Shader.SetUniform('PositionCount',TriangleCount);
		}
		
		const DoubleBuffering = Params.DoubleBufferPhysics;
		if ( DoubleBuffering )
		{
			//	double buffer flip
			if ( !this.PhysicsFlipped )
			{
				PhysicsIteration( RenderTarget, Time, DurationSecs, this.PositionTexture, this.VelocityTexture, this.ScratchPositionTexture, this.ScratchVelocityTexture, this.PositionOrigTexture, this.UpdateVelocityShader, this.UpdatePositionShader, SetAnimalPhysicsUniforms, !DoubleBuffering );
			}
			else
			{
				PhysicsIteration( RenderTarget, Time, DurationSecs, this.ScratchPositionTexture, this.ScratchVelocityTexture, this.PositionTexture, this.VelocityTexture, this.PositionOrigTexture, this.UpdateVelocityShader, this.UpdatePositionShader, SetAnimalPhysicsUniforms, !DoubleBuffering );
			}
			this.PhysicsFlipped = !this.PhysicsFlipped;
		}
		else
		{
			PhysicsIteration( RenderTarget, Time, DurationSecs, this.PositionTexture, this.VelocityTexture, this.ScratchPositionTexture, this.ScratchVelocityTexture, this.PositionOrigTexture, this.UpdateVelocityShader, this.UpdatePositionShader, SetAnimalPhysicsUniforms, !DoubleBuffering );
		}
	}
	
	this.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
	{
		const Actor = this;
		const RenderContext = RenderTarget.GetRenderContext();
		
		const Geo = GetAsset( this.Geometry, RenderContext );
		const Shader = GetAsset( this.RenderShader, RenderContext );
		const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];
		const PositionTexture = this.GetPositionTexture(Time);
		if ( !PositionTexture )
		{
			Pop.Debug("Actor has no position texture",Actor);
			return;
		}
		let ColourTexture = this.TextureBuffers.ColourTexture;
		const AlphaTexture = this.TextureBuffers.AlphaTexture;
		const LocalToWorldTransform = this.GetLocalToWorldTransform();
		
		const Meta = GetMeta(this);
		if ( Meta.OverridingColourTexture )
			ColourTexture = Meta.OverridingColourTexture;
		
		if ( !ColourTexture )
			ColourTexture = RandomTexture;
		
		//	limit number of triangles
		let Lod = (Meta.Lod !== undefined) ? Meta.Lod : Params.AnimalBufferLod;
		let TriangleCount = Math.min(AutoTriangleMeshCount, Actor.TextureBuffers.TriangleCount) || AutoTriangleMeshCount;
		TriangleCount = Math.floor(TriangleCount * Lod);
		//Pop.Debug("TriangleCount", TriangleCount);
		
		const SetUniforms = function(Shader)
		{
			SetGlobalUniforms( Shader );

			function SetUniform(Key)
			{
				Shader.SetUniform(Key,this[Key]);
			}
			if ( Meta.RenderUniforms )
			{
				Object.keys(Meta.RenderUniforms).forEach( SetUniform.bind(Meta.RenderUniforms) );
			}
			
			Shader.SetUniform('ShowClippedParticle', Params.ShowClippedParticle );
			Shader.SetUniform('LocalToWorldTransform', LocalToWorldTransform );
			Shader.SetUniform('LocalPositions', LocalPositions );
			Shader.SetUniform('BillboardTriangles', Params.BillboardTriangles );
			Shader.SetUniform('WorldPositions',PositionTexture);
			Shader.SetUniform('WorldPositionsWidth',PositionTexture.GetWidth());
			Shader.SetUniform('WorldPositionsHeight',PositionTexture.GetHeight());
			Shader.SetUniform('TriangleScale', Meta.TriangleScale );
			Shader.SetUniform('ColourImage',ColourTexture);
			Shader.SetUniform('Debug_ForceColour', Params.AnimalDebugParticleColour);
			Shader.SetUniform('TriangleCount', TriangleCount);
		}
		
		RenderTarget.DrawGeometry( Geo, Shader, SetUniforms, TriangleCount );
	}
	
	this.GetLocalToWorldTransform = function()
	{
		const Meta = GetMeta(this);
		let Scale = Meta.LocalScale;
		let Scale3 = [Scale,Scale,Scale];
		if ( Meta.LocalFlip )
			Scale3[1] *= -1;
		//	allow flip of the flip
		if ( Params.AnimalFlip )
			Scale3[1] *= -1;
		let ScaleMtx = Math.CreateScaleMatrix( ...Scale3 );
		
		let Transform = Math.MatrixMultiply4x4( this.LocalToWorldTransform, ScaleMtx );
		return Transform;
	}
	
	this.ClearOpenglTextures = function()
	{
		function ClearTexture(Image)
		{
			if ( !Image )
				return;
			Image.DeleteOpenglTexture();
		}
		
		if ( this.PositionAnimationTextures )
			this.PositionAnimationTextures.forEach(ClearTexture);
		
		ClearTexture( this.PositionTexture );
		ClearTexture( this.VelocityTexture );
		ClearTexture( this.ScratchVelocityTexture );
		ClearTexture( this.ScratchPositionTexture );
		//ClearTexture( this.PositionOrigTexture );
	}
	
}

function SetupSwirlTextureBufferActor(Filename,GetMeta)
{
	SetupAnimalTextureBufferActor.call( this, ...arguments );
	
	this.Update = function()
	{
		const Meta = GetMeta(this);
		
		//	check if we've reached the end of the spline
		const SplineMin = Meta.PhysicsUniforms.SplineTime - Meta.PhysicsUniforms.SplineTimeRange;
		if ( SplineMin >= 1 )
		{
			//	cleanup
			this.ClearOpenglTextures();
			return false;
		}
		return true;
	}
	
}


function TActor(Transform,Geometry,Shader,Uniforms)
{
	this.SpawnTime = Pop.GetTimeNowMs();
	this.LocalToWorldTransform = Transform;
	this.Geometry = Geometry;
	this.RenderShader = Shader;
	this.Uniforms = Uniforms || [];
	this.BoundingBox = null;
	
	this.Update = function(TimeStepSecs)
	{
		//	return false to delete actor
		return true;
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
	}
	
	this.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
	{
		const RenderContext = RenderTarget.GetRenderContext();
		const Geo = GetAsset( this.Geometry, RenderContext );
		const Shader = GetAsset( this.RenderShader, RenderContext );
		const LocalToWorldTransform = this.GetLocalToWorldTransform();
		
		const SetUniforms = function(Shader)
		{
			SetGlobalUniforms( Shader );
			Shader.SetUniform('LocalToWorldTransform', LocalToWorldTransform );
		}
		
		RenderTarget.DrawGeometry( Geo, Shader, SetUniforms );
	}
	
	this.GetLocalToWorldTransform = function()
	{
		return this.LocalToWorldTransform;
	}
	
	this.GetBoundingBox = function()
	{
		return this.BoundingBox;
	}
	
	this.ClearOpenglTextures = function()
	{
		
	}
}

function GetActorWorldPos(Actor)
{
	const Transform = Actor.GetLocalToWorldTransform();
	return Math.GetMatrixTranslation( Transform );
}


function UpdateNoiseTexture(RenderTarget,Texture,NoiseShader,Time)
{
	//Pop.Debug("UpdateNoiseTexture",Texture,Time);
	const RenderContext = RenderTarget.GetRenderContext();
	const Shader = GetAsset( NoiseShader, RenderContext );
	const Quad = GetAsset('Quad',RenderContext);
	
	const RenderNoise = function(RenderTarget)
	{
		RenderTarget.ClearColour(0,0,1);
		const SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Time', Time );
			Shader.SetUniform('_Frequency',Params.Turbulence_Frequency);
			Shader.SetUniform('_Amplitude',Params.Turbulence_Amplitude);
			Shader.SetUniform('_Lacunarity',Params.Turbulence_Lacunarity);
			Shader.SetUniform('_Persistence',Params.Turbulence_Persistence);
		}
		RenderTarget.DrawGeometry( Quad, Shader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( Texture, RenderNoise );
}



function RenderScene(Scene,RenderTarget,Camera,Time,GlobalUniforms)
{
	const Viewport = RenderTarget.GetRenderTargetRect();
	const CameraProjectionTransform = Camera.GetProjectionMatrix(Viewport);
	const WorldToCameraTransform = Camera.GetWorldToCameraMatrix();
	const CameraToWorldTransform = Math.MatrixInverse4x4(WorldToCameraTransform);
	
	GlobalUniforms['WorldToCameraTransform'] = WorldToCameraTransform;
	GlobalUniforms['CameraToWorldTransform'] = CameraToWorldTransform;
	GlobalUniforms['CameraProjectionTransform'] = CameraProjectionTransform;
	
	function RenderSceneActor(Actor,ActorIndex)
	{
		const SetGlobalUniforms = function(Shader)
		{
			function SetUniforms(Array)
			{
				function SetUniform(Key)
				{
					const Value = Array[Key];
					Shader.SetUniform( Key, Value );
				}
				Object.keys( Array ).forEach( SetUniform );
			}
			SetUniforms( GlobalUniforms );
			SetUniforms( Actor.Uniforms );
		}
		
		//try
		{
			Actor.Render( RenderTarget, ActorIndex, SetGlobalUniforms, Time );
		}
		/*
		 catch(e)
		 {
		 Pop.Debug("Error rendering actor", Actor.Name,e);
		 }
		 */
	}
	
	Scene.forEach( RenderSceneActor );
}



function InitDebugHud(Hud)
{
	if ( IsDebugEnabled() )
	{
		let DebugHud = new Pop.Hud.Label('Debug');
		DebugHud.SetVisible(true);
	}
	Hud.Debug_State = new Pop.Hud.Label('Debug_State');
	Hud.Debug_VisibleActors = new Pop.Hud.Label('Debug_VisibleActors');
	Hud.Debug_RenderedActors = new Pop.Hud.Label('Debug_RenderedActors');
	Hud.Debug_RenderStats = new Pop.Hud.Label('Debug_RenderStats');
	Hud.Debug_FrameRate = new Pop.Hud.Label('Debug_FrameRate');
	Hud.Debug_TextureHeap = new Pop.Hud.Label('Debug_TextureHeap');
	Hud.Debug_GeometryHeap = new Pop.Hud.Label('Debug_GeometryHeap');
	
	Window.RenderFrameCounter.Report = function(CountPerSec)
	{
		Hud.Debug_FrameRate.SetValue( CountPerSec.toFixed(2) + " fps" );
	}
}

function UpdateDebugHud(Hud)
{
	try
	{
		const TextureHeapCount = Window.TextureHeap.AllocCount;
		const TextureHeapSizeMb = Window.TextureHeap.AllocSize / 1024 / 1024;
		Hud.Debug_TextureHeap.SetValue("Textures x" + TextureHeapCount + " " + TextureHeapSizeMb.toFixed(2) + "mb" );
		const GeometryHeapCount = Window.GeometryHeap.AllocCount;
		const GeometryHeapSizeMb = Window.GeometryHeap.AllocSize / 1024 / 1024;
		Hud.Debug_GeometryHeap.SetValue("Geometry x" + GeometryHeapCount + " " + GeometryHeapSizeMb.toFixed(2) + "mb" );
	}
	catch(e)
	{
		//Pop.Debug(e);
	}
	
	//	reset stats once per frame
	const ResetRenderStats = function()
	{
		//	reset render stats
		let Stats = "Batches: " + Pop.Opengl.BatchesDrawn;
		Stats += " Triangles: " + Pop.Opengl.TrianglesDrawn;
		Stats += " Geo Binds: " + Pop.Opengl.GeometryBinds;
		Stats += " Shader Binds: " + Pop.Opengl.ShaderBinds;
		Hud.Debug_RenderStats.SetValue(Stats);
		Pop.Opengl.BatchesDrawn = 0;
		Pop.Opengl.TrianglesDrawn = 0;
		Pop.Opengl.GeometryBinds = 0;
		Pop.Opengl.ShaderBinds = 0;
	}
	ResetRenderStats();

}


function GetRandomSwirlPath(Count)
{
	const Positions = [];
	
	Positions.push([0,0,0]);
	
	//	make some random points for the bezier
	for ( let p=1;	p<Count;	p++ )
	{
		let x = Math.random();
		let y = Math.random();
		let z = Math.random();
		Positions.push([x,y,z]);
	}
	return Positions;
}


function GetForwardSwirlPath(Count)
{
	//	start at 0,0,0
	const Positions = [];
	Positions.push( [0,0,0] );
	
	//	randomly move forward but try and gravitate towards 0,0,1 if we go too far
	for ( let i=1;	i<Count;	i++ )
	{
		const x = Params.Spline_ForwardDeviateX;
		const y = Params.Spline_ForwardDeviateY;
		const z = -Params.Spline_ForwardDeviateZ;
		
		const LastPos = Positions[i-1];
		let Pos = LastPos.slice();
		const Target = Pos.slice();
		Target[2] += z*2;
		
		//	random pos
		Pos[0] += Math.lerp( -x, x, Math.random() );
		Pos[1] += Math.lerp( -y, y, Math.random() );
		Pos[2] += Math.lerp( 0, z*2, Math.random() );
		
		//	now gravitate towards the target
		Pos = Math.Lerp3( Pos, Target, Params.Spline_LerpToTarget );
		Pos = Math.Subtract3( Pos, LastPos );
		Pos = Math.Normalise3( Pos, Params.Swirl_NodeDistance );
		Pos = Math.Add3( Pos, LastPos );
		
		Positions.push( Pos );
	}
	
	return Positions;
}

function GetBrownianSwirlPath(Count)
{
	//	calc 2 random points
	const Positions = GetRandomSwirlPath(2);
	
	const MaxDist3 = [Params.Swirl_NodeDistance,Params.Swirl_NodeDistance,Params.Swirl_NodeDistance];
	//	cap first distance - gr: could use lerp3 here
	Positions[1] = Math.Normalise3( Positions[1], Params.Swirl_NodeDistance );
	
	//	now add more vaguely in the correct direction
	while ( Positions.length < Count )
	{
		const LastIndex = Positions.length-1;
		let Dir = Math.Subtract3( Positions[LastIndex], Positions[LastIndex-1] );
		Dir = Math.Normalise3( Dir );
		
		let x = Math.random() - 0.5;
		let y = Math.random() - 0.5;
		let z = Math.random() - 0.5;
		let Delta = [x,y,z];
		
		//	flip if going in the wrong direction (up to 90 degrees - lets make this more clever)
		Delta = Math.Normalise3(Delta);
		const Dot = Math.Dot3( Dir, Delta );
		if ( Dot < 0 )
		{
			Delta = Math.Multiply3( Delta, [-1,-1,-1] );
		}
		
		//	cap length
		Delta = Math.Multiply3( Delta, MaxDist3 );
		
		Delta = Math.Add3( Positions[LastIndex], Delta );
		Positions.push( Delta );
	}
	
	return Positions;
}



function GenerateRandomSplinePathVertexes(Contents,OnVertex,OnMeta)
{
	Pop.Debug("GenerateRandomSplinePathVertexes");
	const Positions = CreateRandomSplinePath( Params.Swirl_NodeCount, Params.Swirl_PointCount );
	Positions.forEach( Pos => OnVertex(...Pos) );
}

function GetSwirlMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	
	Meta.Filename = 'GenerateRandomSplinePathVertexes()';
	Meta.RenderShader = AnimalParticleShader;
	
	//	single pass/MRT
	if ( UpdateSwirlShader )
	{
		Meta.VelocityShader = null;
		Meta.PositionShader = UpdateSwirlShader;
	}
	else
	{
		Meta.VelocityShader = UpdateVelocitySwirlShader;
		Meta.PositionShader = UpdatePositionShader;
	}
	
	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.Damping = Params.Swirl_Physics_Damping;
	Meta.PhysicsUniforms.SpringScale = Params.Swirl_Physics_SpringScale;
	Meta.PhysicsUniforms.MaxSpringForce = Params.Swirl_Physics_MaxSpringForce;
	Meta.PhysicsUniforms.StringStrips = Params.Swirl_Physics_SplineStrips;
	Meta.PhysicsUniforms.SplineTimeRange = Params.Swirl_Physics_SplineTimeRange;

	if ( Params.Swirl_Physics_CustomSplineTime )
	{
		Meta.PhysicsUniforms.SplineTime = Params.Swirl_Physics_SplineTime;
	}
	else
	{
		if ( Actor && Actor.SpawnTime )
		{
			let Time = Pop.GetTimeNowMs() - Actor.SpawnTime;
					
			Time /= 1000;
			Time /= Params.Swirl_Physics_SplineDuration;
			
			Meta.PhysicsUniforms.SplineTime = Time;
		}
		else
		{
			Meta.PhysicsUniforms.SplineTime = Pop.GetTimeNowMs() / 1000 * Params.Swirl_Physics_SplineTimeSpeed;
			Meta.PhysicsUniforms.SplineTime %= 1;
		}
	}
	//Pop.Debug("SplineTime",Meta.PhysicsUniforms.SplineTime);
	
	Meta.PhysicsUniforms.Noise = Noise_TurbulenceTexture;
	Meta.PhysicsUniforms.LocalNoiseScale = Params.Swirl_Physics_LocalNoiseScale;
	Meta.PhysicsUniforms.SplineNoiseScale = Params.Swirl_Physics_SplineNoiseScale;
	
	const LodMin = 1 - Math.RangeClamped( 1 - Meta.PhysicsUniforms.SplineTimeRange, 1, Meta.PhysicsUniforms.SplineTime );
	const LodMax = Math.RangeClamped( 0, Meta.PhysicsUniforms.SplineTimeRange, Meta.PhysicsUniforms.SplineTime );

	Meta.Lod = Math.min( LodMin, LodMax );
	Meta.Lod *= Params.AnimalBufferLod;

	Meta.TriangleScale = Params.Swirl_TriangleScale;
	
	let SwirlColourTexture = Pop.Global.SwirlColourTexture;
	if ( SwirlColourTexture !== undefined )
		Meta.OverridingColourTexture = SwirlColourTexture;
	
	//Meta.FitToBoundingBox = true;
	return Meta;
}

let SplineRandomPointSet = null;


function CreateCubeActor(ActorNode,Solid=false)
{
	let Actor = new TActor();
	Actor.Name = ActorNode.Name;
	
	let LocalScale = ActorNode.Scale;
	let WorldPos = ActorNode.Position;
	Actor.Geometry = 'Cube';
	
	let RenderAsBounds = true;
	
	//	some nodes have no geometry, so no bounding box
	if ( !ActorNode.BoundingBox )
	{
		ActorNode.BoundingBox = {};
		ActorNode.BoundingBox.Min = [0,0,0];
		ActorNode.BoundingBox.Max = [1,1,1];
		RenderAsBounds = false;
	}
	
	if ( RenderAsBounds )
	{
		//	undo the bounds scale and render the cube at the bounds scale
		//	but that'll scale bounds too, so undo that (just to 0..1)
		let BoundsCenter = Math.Lerp3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min, 0.5 );
		let BoundsScale = Math.Subtract3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min );
		
		BoundsScale = Math.Multiply3( BoundsScale, [0.5,0.5,0.5] );
		
		LocalScale = BoundsScale;
		WorldPos = Math.Add3( WorldPos, BoundsCenter );
		ActorNode.BoundingBox.Max = [1,1,1];
		ActorNode.BoundingBox.Min = [-1,-1,-1];
		Pop.Debug( ActorNode.Name, "BoundsScale", BoundsScale, "ActorNode.Scale", ActorNode.Scale );
	}
	
	let LocalScaleMtx = Math.CreateScaleMatrix( ...LocalScale );
	let WorldPosMtx = Math.CreateTranslationMatrix( ...WorldPos );
	
	Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( WorldPosMtx, LocalScaleMtx );
	
	Actor.RenderShader = (Solid===true) ? GeoColourShader : GeoEdgeShader;
	Actor.BoundingBox = ActorNode.BoundingBox;
	
	return Actor;
}

function CreateRandomSplinePath(NodeCount,PointCount,NodePoints=[])
{
	if ( !Params.Swirl_PersistentPath )
		SplineRandomPointSet = null;
	
	//	keep points persistent so we can modify some values for testing
	if ( SplineRandomPointSet && SplineRandomPointSet.length != NodeCount )
		SplineRandomPointSet = null;
	
	if ( !SplineRandomPointSet )
	{
		//SplineRandomPointSet = GetBrownianSwirlPath(NodeCount);
		SplineRandomPointSet = GetForwardSwirlPath(NodeCount);
	}
	
	const Nodes = SplineRandomPointSet;
	if ( NodePoints )
		NodePoints.push( ...Nodes );
	
	//	now fill bezier inbetween
	const PathPoints = [];
	for ( let i=0;	i<PointCount;	i++ )
	{
		let t = i / (PointCount-1);
		const Pos = Math.GetCatmullPathPosition( Nodes, t, Params.Swirl_PathLoop );
		PathPoints.push( Pos );
	}
	
	return PathPoints;
}

function CreateSplineActors(PushActor)
{
	function PushSplinePointActor(xyz,Index,Size)
	{
		if ( !xyz )
			return;
		const Node = {};
		Node.Scale = [Size,Size,Size];
		Node.Position = xyz;
		Node.Name = 'x';
		const Actor = CreateCubeActor( Node, true );
		PushActor(Actor);
	}
	
	let PathNodes = [];
	let PathPoints = CreateRandomSplinePath( Params.Swirl_NodeCount, Params.Spline_PointCount, PathNodes );
	
	PathPoints.forEach( Pos => PushSplinePointActor( Pos, 0, 0.01 ) );
	
	if ( Params.Swirl_ShowPathNodePoints )
		PathNodes.forEach( Pos => PushSplinePointActor(Pos,0,0.03) );
}


