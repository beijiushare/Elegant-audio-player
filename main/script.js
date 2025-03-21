document.addEventListener("DOMContentLoaded", function () {
  // 获取DOM元素
  const mediaFileBtn = document.getElementById("media-file-btn");
  const subtitleFileBtn = document.getElementById("subtitle-file-btn");
  const backgroundFileBtn = document.getElementById("background-file-btn");
  const pipToggleButton = document.getElementById("pip-toggle-btn");
  const mediaFileInput = document.getElementById("media-file");
  const subtitleFileInput = document.getElementById("subtitle-file");
  const backgroundFileInput = document.getElementById("background-file");
  const playButton = document.getElementById("play");
  const pauseButton = document.getElementById("pause");
  const seekBar = document.getElementById("seek-bar");
  const progressBar = document.getElementById("progress");
  const currentTimeElement = document.getElementById("current-time");
  const durationElement = document.getElementById("duration");
  const subtitleContainer = document.getElementById("subtitle-container");
  const mediaFileNameElement = document.getElementById("media-file-name");
  const subtitleFileNameElement = document.getElementById("subtitle-file-name");
  const backgroundFileNameElement = document.getElementById(
    "background-file-name"
  );
  const canvas = document.getElementById("video-canvas");
  const ctx = canvas.getContext("2d");

  // 创建音频对象
  const audio = new Audio();

  // 存储字幕数据
  let subtitles = [];
  let currentSubtitleIndex = -1;
  let isMetadataLoaded = false;

  // 媒体和字幕文件
  let currentMediaFile = null;
  let currentSubtitleFile = null;
  let currentBackgroundFile = null;

  // 播放控制
  let isPlaying = false;

  // 设置画布尺寸
  canvas.width = 640;
  canvas.height = 360;

  // 创建虚拟视频流
  const stream = canvas.captureStream(25);
  const videoElement = document.createElement("video");
  videoElement.srcObject = stream;
  videoElement.style.display = "none";
  document.body.appendChild(videoElement);

  // 音频播放/暂停状态
  function togglePlayPause() {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play();
      isPlaying = true;
    }
  }

  // 更新时间显示和字幕
  function updateTimer() {
    const currentTime = audio.currentTime;
    const duration = audio.duration;

    // 格式化时间
    const formatTime = (seconds) => {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    };

    currentTimeElement.textContent = formatTime(currentTime);
    durationElement.textContent = formatTime(duration);

    // 更新进度条
    const progressPercent = (currentTime / duration) * 100;
    progressBar.style.width = `${progressPercent}%`;
    seekBar.value = progressPercent;

    // 更新字幕
    updateSubtitle(currentTime);

    // 在画布上绘制字幕（实现画中画同步）
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制当前字幕
    if (currentSubtitleIndex !== -1) {
      const subtitleText = subtitles[currentSubtitleIndex].text;
      const maxWidth = canvas.width * 0.8; // 设置字幕的最大宽度为画布宽度的80%
      const fontSize = 50; // 设置字体大小为32px
      const lineHeight = fontSize + 10; // 设置行高为字体大小加10px

      ctx.fillStyle = "white";
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 按每10个字换行
      const wordsPerLine = 10;
      const words = subtitleText.split("");
      let line = "";
      let lines = [];

      for (let i = 0; i < words.length; i++) {
        line += words[i];
        if (line.length >= wordsPerLine) {
          lines.push(line.trim());
          line = "";
        }
      }
      if (line !== "") {
        lines.push(line.trim());
      }

      // 计算字幕的垂直位置，使其居中显示
      const startY = canvas.height / 2 - (lines.length * lineHeight) / 2;

      // 绘制每一行字幕
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], canvas.width / 2, startY + i * lineHeight);
      }
    }
  }

  // 更新字幕索引
  function updateSubtitle(currentTime) {
    let newSubtitleIndex = -1;

    for (let i = 0; i < subtitles.length; i++) {
      if (
        currentTime >= subtitles[i].start &&
        currentTime <= subtitles[i].end
      ) {
        newSubtitleIndex = i;
        break;
      }
    }

    if (newSubtitleIndex !== currentSubtitleIndex) {
      currentSubtitleIndex = newSubtitleIndex;
      subtitleContainer.textContent =
        currentSubtitleIndex !== -1 ? subtitles[currentSubtitleIndex].text : "";
    }
  }

  // 解析VTT字幕
  function parseVTT(data) {
    const lines = data.split("\n");
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.includes("-->")) {
        const timeParts = line.split(" --> ");
        const startTime = parseTime(timeParts[0]);
        const endTime = parseTime(timeParts[1]);

        let text = "";
        i++;

        while (i < lines.length && lines[i].trim() !== "") {
          text += lines[i].trim() + " ";
          i++;
        }

        result.push({
          start: startTime,
          end: endTime,
          text: text.trim(),
        });
      }
    }

    return result;
  }

  // 解析SRT字幕
  function parseSRT(data) {
    const entries = data.split(/\n\s*\d+\s*\n/);
    const result = [];

    for (let i = 0; i < entries.length; i++) {
      const parts = entries[i].split("\n", 2);
      if (parts.length < 2) continue;

      const timeParts = parts[0].split(" --> ");
      const startTime = parseTime(timeParts[0]);
      const endTime = parseTime(timeParts[1]);

      const text = parts[1].replace(/\s+$/, "").replace(/^\s+/, "");

      result.push({
        start: startTime,
        end: endTime,
        text: text,
      });
    }

    return result;
  }

  // 解析时间字符串
  function parseTime(timeStr) {
    const parts = timeStr.replace(",", ".").split(":");
    let seconds = 0;

    if (parts.length === 3) {
      const hourPart = parts[0].split(".");
      seconds = parseInt(hourPart[0]) * 3600;

      if (hourPart.length > 1) {
        seconds += parseFloat(hourPart[1]);
      } else {
        const minutePart = parts[1].split(".");
        seconds += parseInt(minutePart[0]) * 60;

        if (minutePart.length > 1) {
          seconds += parseFloat(minutePart[1]);
        } else {
          const secondPart = parts[2].split(".");
          seconds += parseInt(secondPart[0]);

          if (secondPart.length > 1) {
            seconds += parseFloat("0." + secondPart[1]);
          }
        }
      }
    }

    return seconds;
  }

  // 事件监听器
  audio.addEventListener("timeupdate", updateTimer);

  audio.addEventListener("loadedmetadata", function () {
    durationElement.textContent = formatTime(audio.duration);
    isMetadataLoaded = true;
  });

  audio.addEventListener("ended", function () {
    isPlaying = false;
  });

  // 文件选择按钮点击事件
  mediaFileBtn.addEventListener("click", function () {
    mediaFileInput.click();
  });

  subtitleFileBtn.addEventListener("click", function () {
    subtitleFileInput.click();
  });

  backgroundFileBtn.addEventListener("click", function () {
    backgroundFileInput.click();
  });

  // 媒体文件选择
  mediaFileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      audio.src = url;
      currentMediaFile = file;

      // 更新文件名显示
      mediaFileNameElement.textContent = file.name;
    }
  });

  // 字幕文件选择
  subtitleFileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();

      reader.onload = function (event) {
        const data = event.target.result;
        let parsedSubtitles;

        if (file.name.endsWith(".vtt")) {
          parsedSubtitles = parseVTT(data);
        } else if (file.name.endsWith(".srt")) {
          parsedSubtitles = parseSRT(data);
        } else {
          alert("不支持的字幕格式");
          return;
        }

        subtitles = parsedSubtitles;
        currentSubtitleIndex = -1;
        subtitleContainer.textContent = "";

        // 更新字幕文件名显示
        subtitleFileNameElement.textContent = file.name;
      };

      reader.readAsText(file);
      currentSubtitleFile = file;
    }
  });

  // 背景文件选择
  backgroundFileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);

      // 设置背景图片
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";

      // 更新文件名显示
      backgroundFileNameElement.textContent = file.name;
    }
  });

  // 播放控制
  playButton.addEventListener("click", function () {
    if (currentMediaFile) {
      if (!isPlaying) {
        audio.play();
        isPlaying = true;
      }
    }
  });

  pauseButton.addEventListener("click", function () {
    if (currentMediaFile) {
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
      }
    }
  });

  // 进度条控制
  seekBar.addEventListener("input", function (e) {
    if (currentMediaFile && audio.duration) {
      const seekTime = (e.target.value / 100) * audio.duration;
      audio.currentTime = seekTime;
    }
  });

  // 画中画功能
  pipToggleButton.addEventListener("click", async function () {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
        // 确保视频元素播放状态同步
        if (isPlaying) videoElement.play();
      }
    } catch (error) {
      console.error("画中画操作失败", error);
    }
  });

  // 添加键盘控制
  document.addEventListener("keydown", function (e) {
    if (!currentMediaFile) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        togglePlayPause();
        break;
      case "ArrowRight":
        audio.currentTime += 5; // 向右移动5秒
        break;
      case "ArrowLeft":
        audio.currentTime -= 5; // 向左移动5秒
        break;
    }
  });

  // 格式化时间函数
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // 维持画布活动
  function animate() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, 1, 1);
    requestAnimationFrame(animate);
  }
  animate();
});
