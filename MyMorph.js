// Morph.js

// 全局变量
var gl;				// WebGL上下文
var halfSize = 1;	//正方形边长的一半
var u_MVPMatrix;	//shader中uniform变量u_MVPMatrix的索引
var matProj;		//投影矩阵，在main中赋值，在render中使用
var angle = [0.0,0.0,0.0];	//绕3个旋转轴旋转的角度，初始为0
var axis = 1;				//当前旋转轴（0-x轴，1-y轴，2-z轴）
var delta = 60;				//每秒角度增量

var nVertexCountPerSide = 9;	//正方形细分后每行顶点数
var nVertexCount = nVertexCountPerSide * nVertexCountPerSide;//一个面的顶点数
//一个面的三角形数
var nTriangleCount = (nVertexCountPerSide - 1) * (nVertexCountPerSide - 1) * 2;
var nIndexCount = 3 * nTriangleCount;	//一个面的顶点索引数

var time  = 0;		//时间，用于控制形变动画的参数
var u_Time;			//shader中uniform变量u_Time的索引
// 页面加载完成后会调用此函数，函数名可任意(不一定为main)
window.onload = function main(){
	// 获取页面中id为webgl的canvas元素
    var canvas = document.getElementById("webgl");
	if(!canvas){ // 获取失败？
		alert("获取canvas元素失败！"); 
		return;
	}
	
	// 利用辅助程序文件中的功能获取WebGL上下文
	// 成功则后面可通过gl来调用WebGL的函数
    gl = WebGLUtils.setupWebGL(canvas);    
    if (!gl){ // 失败则弹出信息
		alert("获取WebGL上下文失败！"); 
		return;
	}        

	/*设置WebGL相关属性*/
	// 设置视口，占满整个canvas
	gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0); // 设置背景色为白色
	gl.enable(gl.DEPTH_TEST);	// 开启深度检测
	gl.enable(gl.CULL_FACE);	// 开启面剔除，默认剔除背面
     
	/*视域体设置*/
	matProj = ortho(-halfSize * 2,halfSize * 2,		//x范围
					-halfSize * 2,halfSize * 2,		//x范围
					-halfSize * 2,halfSize * 2);	//x范围
	
	/*顶点坐标数据初始化*/
	var vertices = [];  
	//x和y方向相邻顶点间距
	var step = halfSize * 2 / (nVertexCountPerSide - 1);
	var y = halfSize;	//初始y坐标
	//计算前方面的所有顶点坐标
	for(var i = 0;i < nVertexCountPerSide;i++)
	{
		var x = -halfSize; //初始x坐标
		for (var j = 0;j < nVertexCountPerSide;j ++)
		{
			vertices.push(vec3(x,y,halfSize));
			x += step;
		}
		y -= step;
	}
	/*索引数组*/
	var indexes = new Uint16Array(nIndexCount);
	var index = 0;	//indexes数组下标
	var start = 0;	//初始索引
	for(var i = 0;i < nVertexCountPerSide - 1;i ++){
		for(var j = 0;j < nVertexCountPerSide - 1;j ++){
			//添加构成一个小正方形的两个三角形的顶点索引
			indexes[index++] = start;
			indexes[index++] = start + nVertexCountPerSide;
			indexes[index++] = start + nVertexCountPerSide + 1;
			indexes[index++] = start;
			indexes[index++] = start + nVertexCountPerSide + 1;
			indexes[index++] = start + 1;
			start ++;	
		}
		start ++;
	}

	/*创建并初始化一个缓冲区对象(Buffer Object)，用于存顶点坐标*/
	var verticesBufferId = gl.createBuffer();//创建buffer
	//将id为verticesBufferId的buffer绑定为当前Array Buffer
	gl.bindBuffer(gl.ARRAY_BUFFER,verticesBufferId);
	//为当前Array Buffer提供数据，传输到GPU
	gl.bufferData(gl.ARRAY_BUFFER,	//Buffer类型
			flatten(vertices),	//Buffer数据来源
			gl.STATIC_DRAW);		//表明是一次提供数据，多遍绘制

	/*创建并初始化一个缓冲区对象(Buffer Object)，用于存顶点索引序列*/
	var indexBufferId = gl.createBuffer();//创建buffer
	//将id为indexBufferId的buffer绑定为当前Element Array Buffer
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBufferId);
	//为当前Array Buffer提供数据，传输到GPU
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,	//Buffer类型
			indexes,				//Buffer数据来源
			gl.STATIC_DRAW);		//表明是一次提供数据，多遍绘制
	
	/*加载shader程序并为shader中attribute变量提供数据*/
	// 加载id分别为"vertex-shader"和"fragment-shader"的shader程序，
	// 并进行编译和链接，返回shader程序对象program
    var program = initShaders(gl, "vertex-shader", 
		"fragment-shader");
    gl.useProgram(program);	// 启用该shader程序对象 
	
	/*初始化顶点着色器中的顶点位置属性*/
	//获取名称为"a_Position"的shader attribute变量的位置
	var a_Position = gl.getAttribLocation(program,"a_Position");
	if(a_Position < 0)//getAttribLocation获取失败则返回-1
	{
		alert("获取attribute变量a_Position失败！");
		return;
	}
	
	u_Time = gl.getUniformLocation(program,"u_Time");
	if(!u_Time)//getAttribLocation获取失败则返回-1
	{
		alert("获取uniform变量u_Time失败！");
		return;
	}
	gl.uniform1f(u_Time,0.0);	//给u_Time一个初始值
	
	//指定利用当前Array Buffer为a_Position提供数据具体方式
	gl.vertexAttribPointer(a_Position,//shader attribute变量位置
		3,			//每个顶点属性有3个分量
		gl.FLOAT,	//数组数据类型（浮点型）
		false,		//不进行归一化处理
		0,			//相邻顶点属性首址间隔
		0);			//第一个顶点属性在Buffer中偏移量为0字节
	gl.enableVertexAttribArray(a_Position);//启用顶点属性数组
		
	/*获取shader中uniform变量索引*/
	u_MVPMatrix = gl.getUniformLocation(program,"u_MVPMatrix");
	if(!u_MVPMatrix)
	{
		alert("获取uniform变量u_MVPMatrix失败！");
		return;
	}
	var u_MinDist = gl.getUniformLocation(program,"u_MinDist");
	if(!u_MinDist)
	{
		alert("获取uniform变量u_MinDist失败！");
		return;
	}
	var u_MaxDist = gl.getUniformLocation(program,"u_MaxDist");
	if(!u_MaxDist)
	{
		alert("获取uniform变量u_MaxDist失败！");
		return;
	}
	
	/*u_MinDist和u_MaxDist的值在整个程序执行过程中不变，因此可在main中为其传值*/
	//立方体中心到立方体表面最近的距离
	gl.uniform1f(u_MinDist,halfSize);
	//立方体中心到立方体表面最远的距离
	gl.uniform1f(u_MaxDist,Math.sqrt(3.0) * halfSize);
	
	//添加鼠标按键事件监听器
	canvas.onmousedown = function(){
		switch(event.button){
			case 0:	//鼠标左键
				axis = 0;	//绕x轴旋转
				break;
			case 1:	//鼠标中键
				axis = 1;	//绕y轴旋转
				break;
			case 2:	//鼠标右键
				axis = 2;	//绕z轴旋转
				break;
		}
	};
	
	//屏蔽默认的鼠标右键弹出菜单  
	canvas.oncontextmenu = function(){
		//event.preventDefault();
	};
	
	// 进行绘制
    render();
};

//记录上一次调用函数的时刻
var last = Date.now();
	

//根据时间更新旋转角度
function animation()
{
	//计算距离上次调用经过多长的时间
	var now = Date.now();
	var elapsed = now - last;	//毫秒
	last = now;
	//根据距离上次调用的时间，更新当前旋转角度
	angle[axis] += delta * elapsed / 1000.0;
	angle[axis] %= 360;	//防止溢出

	//更新时间
	time += elapsed / 3000.0;
	if(time > 2)
		time -= 2;	//防止溢出
	
	gl.uniform1f(u_Time,time);	//给shader中u_Time传值
}

// 绘制函数
function render() {
	//更新旋转角度
	animation();
	
	// 清颜色缓存和深度缓存
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
   
	//设置模视投影矩阵
	var matMVP = mult(matProj, mult(rotateX(angle[0]),
			mult(rotateY(angle[1]), rotateZ(angle[2]))));
	gl.uniformMatrix4fv(u_MVPMatrix, false, flatten(matMVP));
   
	
	
	/*用索引数组进行绘制*/
	//用索引数组绘制前方面
	gl.drawElements(
		gl.TRIANGLES,		//绘制图元类型
		nIndexCount,		//顶点索引数
		gl.UNSIGNED_SHORT,	//索引数组元素类型
		0					//偏移量，从第0个顶点开始
	);
	
	gl.uniformMatrix4fv(u_MVPMatrix,false,flatten(mult(matMVP,rotateX(180))));
	//用索引数组绘制后方面
	gl.drawElements(
		gl.TRIANGLES,		//绘制图元类型
		nIndexCount,		//顶点索引数
		gl.UNSIGNED_SHORT,	//索引数组元素类型
		0					//偏移量，从第0个顶点开始
	);
	
	gl.uniformMatrix4fv(u_MVPMatrix,false,flatten(mult(matMVP,rotateY(90))));
	//用索引数组绘制左方面
	gl.drawElements(
		gl.TRIANGLES,		//绘制图元类型
		nIndexCount,		//顶点索引数
		gl.UNSIGNED_SHORT,	//索引数组元素类型
		0					//偏移量，从第0个顶点开始
	);
	gl.uniformMatrix4fv(u_MVPMatrix,false,flatten(mult(matMVP,rotateY(-90))));
	//用索引数组绘制右方面
	gl.drawElements(
		gl.TRIANGLES,		//绘制图元类型
		nIndexCount,		//顶点索引数
		gl.UNSIGNED_SHORT,	//索引数组元素类型
		0					//偏移量，从第0个顶点开始
	);
	
	gl.uniformMatrix4fv(u_MVPMatrix,false,flatten(mult(matMVP,rotateX(90))));
	//用索引数组绘制上方面
	gl.drawElements(
		gl.TRIANGLES,		//绘制图元类型
		nIndexCount,		//顶点索引数
		gl.UNSIGNED_SHORT,	//索引数组元素类型
		0					//偏移量，从第0个顶点开始
	);
	gl.uniformMatrix4fv(u_MVPMatrix,false,flatten(mult(matMVP,rotateX(-90))));
	//用索引数组绘制下方面
	gl.drawElements(
		gl.TRIANGLES,		//绘制图元类型
		nIndexCount,		//顶点索引数
		gl.UNSIGNED_SHORT,	//索引数组元素类型
		0					//偏移量，从第0个顶点开始
	);
	requestAnimFrame(render);	//请求重绘
	
}
