> Files under `vendor/` are copied from the toolcraft starter kit
> (https://github.com/pixel-point/toolcraft) under the licence below. Only the
> gradient-stops machinery was taken — a self-contained 7-file subset. The rest
> of ZENimator's parameter controls are our own, built on Base UI, with
> toolcraft used as a reference for interaction patterns only.
>
> ONE local deviation, marked in the source: `gradient-stops-controller.ts`
> no longer calls `setPointerCapture` when a stop drag begins. Upstream never
> released that capture, which retargeted every later pointer event to the
> stop button and left the hosting popover unable to see an outside press.

# MIT License

Copyright (c) 2026 Pixel Point

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
