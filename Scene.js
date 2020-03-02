var GpuJobs = [];

//	make this function return your current camera
var Scene_GetRenderCamera = function () { return null; }
var Scene_GetRenderScene = function () { return []; }
var Scene_GetGlobalUniforms = function (){	return {};}
var Scene_GetTime = function() { return 0; }
var Scene_GetDebugTextures = function () { return []; }

//	for render-time knowledge of frame duration (for gpu jobs) we need to keep a copy
//	we should make this genericly updaed somewhere
var LastUpdateFrameDuration = false;


function FlushGpuJobs(RenderTarget)
{
	const RunJob = function (Job)
	{
		Job(RenderTarget);
	}
	GpuJobs.forEach(RunJob);

	GpuJobs.length = 0;
}



function Scene_Render(RenderTarget,RenderCamera)
{
	const RenderContext = RenderTarget.GetRenderContext();
	RenderTarget.ClearColour(0,1,1);
	
	const IsXrRender = (RenderCamera != null);

	//	if we don't have a camera from XR, use the normal system
	if (!RenderCamera)
	{
		RenderCamera = Scene_GetRenderCamera();
		//	skip render in xr mode atm
		if (Params.XrMode)
		{
			if (!Params.UseDebugCamera)
				return;
		}
	}
	else
	{
		//Pop.Debug("Render with xr camera",Camera);
		//	turn the XR camera setup into a pop camera
		const Camera = new Pop.Camera();
		Object.assign(Camera,RenderCamera);
		Camera.Position[0] = RenderCamera.Transform.position.x;
		Camera.Position[1] = RenderCamera.Transform.position.y;
		Camera.Position[2] = RenderCamera.Transform.position.z;

		if (Params.XrTrackTimelineCamera)
		{
			//	todo: use getOffsetReferenceSpace to find out where head should be,
			//		we currently are setting the camera head pos with the XR pose (which is like 6foot out)
			//	todo: this may need to align forward
			const TimelinePosition = Acid.GetCameraPosition();
			Camera.Position = Math.Add3(Camera.Position,TimelinePosition);
		}


		//	get rotation from pose
		//	gr: seems to be inverted in mozilla emulator
		const RotationMatrix = RenderCamera.Transform.matrix;
		Camera.Rotation4x4 = Params.XrInvertRotation ? Math.MatrixInverse4x4(RotationMatrix) : Array.from(RotationMatrix);
		Math.SetMatrixTranslation(Camera.Rotation4x4,0,0,0);

		LastXrCameras[Camera.Name] = Camera;

		RenderCamera = Camera;

		//	skip rendering if debug camera is on
		//	todo: don't do this if rendering to device
		if (Params.UseDebugCamera)
			return;
	}

	FlushGpuJobs(RenderTarget);

	//	grab scene first, we're only going to update physics on visible items
	const Scene = Scene_GetRenderScene();

	const DurationSecs = LastUpdateFrameDuration;


	//	clear target
	if (Params.DebugCameraClearColour)
	{
		if (RenderCamera.Name == 'Left')
			RenderTarget.ClearColour(1,0,0);
		else if (RenderCamera.Name == 'Right')
			RenderTarget.ClearColour(0,1,0);
		else
			RenderTarget.ClearColour(0,0,1);
	}
	else
	{
		RenderTarget.ClearColour(...Params.FogColour);
	}

	let GlobalUniforms = Scene_GetGlobalUniforms();
	

	function RenderTextureQuad(Texture,TextureIndex)
	{
		if (!Texture.Pixels)
			return;

		let w = 0.1;
		let h = 0.1;
		let x = 0.1;
		let y = 0.1 + (TextureIndex * h * 1.10);

		const Uniforms = {};
		Uniforms['VertexRect'] = [x,y,w,h];
		Uniforms['Texture'] = Texture;
		Uniforms['DrawAlpha'] = Params.DebugTextureAlpha;

		const Actor = new TActor(null,'Quad',BlitDebugShader,Uniforms);
		Scene.push(Actor);
	}

	//	make debug actors
	let DebugTextures = [];
	//if (Params.DebugNoiseTextures && !IsXrRender)
	{
		DebugTextures = Scene_GetDebugTextures();
		//Pop.Debug("Render DebugTextures",DebugTextures);
	}
	DebugTextures.forEach(RenderTextureQuad);

	//	render
	const Time = Scene_GetTime();
	RenderScene(Scene,RenderTarget,RenderCamera,Time,GlobalUniforms);

	//	debug stats
	//Hud.Debug_RenderedActors.SetValue("Rendered Actors: " + Scene.length);
	Window.RenderFrameCounter.Add();
}

