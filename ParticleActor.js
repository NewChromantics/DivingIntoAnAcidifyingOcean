
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
}


function LoadAssetGeoTextureBuffer(RenderTarget)
{
	let Filename = this;
	const MaxPositions = AutoTriangleMeshCount;
	
	//	load texture buffer formats
	const CachedTextureBufferFilename = GetCachedFilename(Filename,'texturebuffer.png');
	if ( Pop.FileExists(CachedTextureBufferFilename) )
	{
		const Contents = Pop.LoadFileAsImage(CachedTextureBufferFilename);
		const GeoTextureBuffers = LoadPackedImage( Contents );
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
	
	{
		//	handle array for animation
		if ( Array.isArray(Filename) )
		{
			const LoadFrame = function(Filename)
			{
				AssetFetchFunctions[Filename] = LoadAssetGeoTextureBuffer.bind(Filename);
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
			AssetFetchFunctions[Filename] = LoadAssetGeoTextureBuffer.bind(Filename);
			this.TextureBuffers = GetAsset( Filename, FakeRenderTarget );
		}
	}
	
	this.UpdateVelocityShader = Meta.VelocityShader;
	this.UpdatePositionShader = Meta.PositionShader;
	this.UpdatePhysics = false;
	
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
		Pop.Debug("this.PositionTexture.GetFormat() = "+Format);
		this.VelocityTexture = new Pop.Image(Size,Format);
		this.ScratchVelocityTexture = new Pop.Image(Size,Format);
		this.ScratchPositionTexture = new Pop.Image(Size,Format);
		//this.PositionOrigTexture = new Pop.Image();
		this.PositionOrigTexture = this.TextureBuffers.PositionTexture;
		//this.PositionOrigTexture.Copy( this.PositionTexture );
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
		if ( !this.UpdatePhysics )
			return;
		
		//	has no physics!
		if ( !this.UpdateVelocityShader || !this.UpdatePositionShader )
			return;
		
		if ( !this.VelocityTexture )
		{
			this.ResetPhysicsTextures();
		}
		
		const Meta = GetMeta(this);
		const TriangleCount = this.TextureBuffers.TriangleCount;
		const SetAnimalPhysicsUniforms = function(Shader)
		{
			SetPhysicsUniforms(Shader);
			
			function ApplyUniform(UniformName)
			{
				const Value = Meta.PhysicsUniforms[UniformName];
				Shader.SetUniform( UniformName, Value );
			}
			Object.keys( Meta.PhysicsUniforms ).forEach( ApplyUniform );
			
			Shader.SetUniform('PositionCount',TriangleCount);
		}
		
		PhysicsIteration_MultipleShaders( RenderTarget, Time, DurationSecs, this.PositionTexture, this.VelocityTexture, this.ScratchVelocityTexture, this.PositionOrigTexture, this.UpdateVelocityShader, this.UpdatePositionShader, SetAnimalPhysicsUniforms );
		//PhysicsIteration_SingleShader( RenderTarget, Time, DurationSecs, this.PositionTexture, this.VelocityTexture, this.ScratchPositionTexture, this.ScratchVelocityTexture, this.PositionOrigTexture, this.UpdateVelocityShader, this.UpdatePositionShader, SetAnimalPhysicsUniforms );
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
		let TriangleCount = Math.min(AutoTriangleMeshCount, Actor.TextureBuffers.TriangleCount) || AutoTriangleMeshCount;
		TriangleCount = Math.floor(TriangleCount * Params.AnimalBufferLod);
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
		ClearTexture( this.ScratchTexture );
		//ClearTexture( this.PositionOrigTexture );
	}
	
}



function TActor(Transform,Geometry,Shader,Uniforms)
{
	this.LocalToWorldTransform = Transform;
	this.Geometry = Geometry;
	this.RenderShader = Shader;
	this.Uniforms = Uniforms || [];
	this.BoundingBox = null;
	
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
			let SetUniformOfThisArray = function(Key)
			{
				let Value = this[Key];
				Shader.SetUniform( Key, Value );
			}
			Object.keys( GlobalUniforms ).forEach( SetUniformOfThisArray.bind(GlobalUniforms) );
			Object.keys( Actor.Uniforms ).forEach( SetUniformOfThisArray.bind(Actor.Uniforms) );
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
