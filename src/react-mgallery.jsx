import React from 'react';
import './style.less';

// 全屏视窗
let _viewSize = { w: window.innerWidth, h: window.innerHeight },
    _viewCenterPoint = { x: _viewSize.w/2, y: _viewSize.h/2 };

let _direction,// 'x', 'y', 0
    _initialDistance,
    _initialScale,
    _initialScalerX,
    _initialScalerY,
    _initialCenterPoint,
    _lastCenterPoint;

const DIRECTION_CHECK_OFFSET = 9;


// 计算两点间距
function _calculatePointsDistance(p1, p2) {
    let x0 = Math.abs(p1.x - p2.x);
    let y0 = Math.abs(p1.y - p2.y);

    return Math.round(Math.sqrt(x0*x0 + y0*y0));
}
function _calculateCenterPoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p1.y) / 2
    };
}
function _touchToPoint(touch) {
    return { x: touch.pageX, y: touch.pageY };
}
function _limit(min, val, max){
    return Math.max(min, Math.min(max, val));
}
// 计算图片缩放后的尺寸超出视窗边界
function _calculateBounds(destScale, item = _viewSize) {
    let delta = {
        x: (item.w * destScale - _viewSize.w) / 2,
        y: (item.h * destScale - _viewSize.h) / 2
    };

    // 计算缩放后拖拽边界
    let bounds = {
        minX: delta.x < 0 ? 0 : -delta.x,
        maxX: delta.x < 0 ? 0 : delta.x,
        minY: delta.y < 0 ? 0 : -delta.y,
        maxY: delta.y < 0 ? 0 : delta.y,
    };

    if(item.long) {
        bounds.maxY = item.h * (destScale - 1) / 2;
        bounds.minY = -((item.h - _viewSize.h) + item.h * (destScale - 1) / 2);
    }

    return bounds;
}

export default React.createClass({
    getDefaultProps: function () {
        return {
            gap: 30,// 切换过程中相邻图片的间隙
            actionDistance: 10,// 触发切换图片需要拖拽的距离

            currentIndex: 0,
            maxScale: 2,
            minScale: 1,

            onLoading() {},
            onLoaded() {},
        };
    },
    getInitialState() {
        return {
            currentIndex: this.props.currentIndex || 0,
            lazyImgs: {},
            imgData: {},

            x0: 0,// x轴滑动偏移量
            scale: 1,
            scalerX: 0,
            scalerY: 0,

            transition: 0
        };
    },

    init(touches) {
        let p1 = _touchToPoint(touches[0]);
        const {scale, scalerX, scalerY} = this.state;

        if(touches.length > 1){
            let p2 = _touchToPoint(touches[1]);

            // 缓存两个触点间初始距离
            _initialDistance = _calculatePointsDistance(p1, p2);
            _initialCenterPoint = _calculateCenterPoint(p1, p2);
        } else {
            _initialCenterPoint = p1;
        }

        _direction = 0;
        _lastCenterPoint = _viewCenterPoint;// tap聚焦效果
        _initialScale = scale;
        _initialScalerX = scalerX;
        _initialScalerY = scalerY;
    },
    touchStart(e) {
        e.preventDefault();
        this.init(e.touches);
    },
    touchMove(e) {
        e.preventDefault();
        this.setState({ transition: 0 });

        let { touches } = e;
        let p1 = _lastCenterPoint = _touchToPoint(touches[0]);

        if(touches.length > 1) {
            // 缩放
            let p2 = _touchToPoint(touches[1]);
            let scale = _calculatePointsDistance(p1, p2) / _initialDistance;
            let destScale = scale * _initialScale;

            _lastCenterPoint = _calculateCenterPoint(p1, p2);
            this.applyScale(destScale);
        } else {
            // 滑动
            const { scale, currentIndex, imgData } = this.state;
            const { gap, imgs } = this.props;
            let scalerX = p1.x - _initialCenterPoint.x + _initialScalerX;
            let scalerY = p1.y - _initialCenterPoint.y + _initialScalerY;
            let item = imgData[currentIndex];
            let { minX, minY, maxX, maxY } = _calculateBounds(scale, item);
            let x0 = 0;

            // 限制图片间间隙
            minX -= gap;
            maxX += gap;
            if(scalerX > maxX) {
                x0 = scalerX - maxX;
                scalerX = maxX;
            }
            else if(scalerX < minX) {
                x0 = scalerX - minX;
                scalerX = minX;
            }

            // 第一张图限制右划切换
            if(currentIndex == 0) x0 = Math.min(0, x0);
            // 最后一张图限制左划切换
            if(currentIndex == imgs.length - 1) x0 = Math.max(0, x0);

            // 应用边界
            scalerY = _limit(minY, scalerY, maxY);
            let nextState = {x0, scalerX, scalerY};

            // 水平切换发生的阈值
            if(Math.abs(scalerX) < DIRECTION_CHECK_OFFSET) {
                nextState.scalerX = 0;
            }

            // 未缩放
            if(scale == 1 && item && item.long) {
                // 判断滚动方向
                if(!_direction) {
                    let deltaX = Math.abs(scalerX - _initialScalerX);
                    let deltaY = Math.abs(scalerY - _initialScalerY);

                    if(deltaY > DIRECTION_CHECK_OFFSET) _direction = 'y';
                    else if(deltaX > DIRECTION_CHECK_OFFSET) _direction = 'x';
                }

                if(_direction == 'x') {
                    // 发生水平滚动时，限制垂直移动
                    delete nextState.scalerY;
                }
                else if (_direction == 'y') {
                    // 发生垂直滚动时，限制水平移动
                    nextState.scalerX = nextState.x0 = 0;
                }
            }

            this.setState(nextState);
        }
    },
    touchEnd(e) {
        const { scale, currentIndex, x0, imgData } = this.state;
        const { maxScale, minScale, actionDistance, imgs } = this.props;
        let { touches } = e;

        if(touches.length) {
            // 为剩下的触点重新初始化
            this.init(touches);
        } else {
            // 触摸结束
            let transition = 1;
            let nextIndex = currentIndex;

            // 判断切换图片
            if(x0 < -actionDistance) nextIndex++;
            else if(x0 > actionDistance) nextIndex--;
            nextIndex = _limit(0, nextIndex, imgs.length - 1);

            if(nextIndex != currentIndex) {
                // 切换
                this.setState({
                    transition,
                    currentIndex: nextIndex,
                    // 重置
                    scale: 1,
                    scalerX: 0,
                    scalerY: 0,
                    x0: 0,
                });
                this.preLoadImg();
            } else {
                // 应用缩放及滑动边界
                let destScale = _limit(minScale, scale, maxScale);
                let bounds = _calculateBounds(destScale, imgData[currentIndex]);
                this.applyScale(destScale, bounds, transition);
            }
        }
    },

    applyScale(destScale, bounds, transition) {
        const { imgData, currentIndex } = this.state;
        let item = imgData[currentIndex];
        let baseY = item.long ? item.h / 2 : _viewCenterPoint.y;
        let baseX = _viewCenterPoint.x;

        // 计算缩放补偿量
        // 触摸中点移动距离 - 缩放导致的触摸中点偏移量
        let scale = destScale / _initialScale;// 相对缩放率，以触摸开始为1
        let scalerX = (_initialScalerX + _lastCenterPoint.x - _initialCenterPoint.x) * scale
            - (_lastCenterPoint.x - baseX) * (scale - 1);
        let scalerY = (_initialScalerY + _lastCenterPoint.y - _initialCenterPoint.y) * scale
            - (_lastCenterPoint.y - baseY) * (scale - 1);

        if(bounds) {
            // 应用边界
            scalerX = _limit(bounds.minX, scalerX, bounds.maxX);
            scalerY = _limit(bounds.minY, scalerY, bounds.maxY);
        }

        // 计算缩放
        this.setState({
            scale: destScale,
            scalerX,
            scalerY,
            x0: 0,
            transition
        });
    },

    preLoadImg(index) {
        const { currentIndex, lazyImgs } = this.state;
        index = index || currentIndex;

        let _lazyImgs = {};
        let nextIndex = Math.min(this.props.imgs.length - 1, index + 1);
        let prevIndex = Math.max(0, index - 1);

        _lazyImgs[index] = 1;
        _lazyImgs[prevIndex] = 1;
        _lazyImgs[nextIndex] = 1;

        this.setState({ lazyImgs: Object.assign({}, lazyImgs, _lazyImgs)});
    },
    imgLoaded(e, i) {
        const { imgData, currentIndex } = this.state;
        if(imgData[i]) return;
        if(i == currentIndex) this.props.onLoaded();

        // 记录图片初始尺寸
        let img = e.target;
        let { width, height, naturalWidth, naturalHeight } = img;
        let fitH = _viewSize.w / naturalWidth * naturalHeight;// 适应屏幕宽度后的高度
        let long = fitH > _viewSize.h;

        width = Math.min(naturalWidth, _viewSize.w);
        height = width * naturalHeight / naturalWidth;

        this.setState({
            imgData: Object.assign({
                [i] : {
                    w: width,
                    h: height,
                    long
                }
            }, imgData)
        });
    },
    render(){
        var { imgs } = this.props;
        var {
            x0, scale, scalerX, scalerY,
            currentIndex, transition, lazyImgs, imgData
        } = this.state;
        var { touchStart, touchMove, touchEnd, imgLoaded } = this;

        return (
            <div className={'mgallery' + (transition ? ' transition' : '')} ref="holder"
                onTouchStart={touchStart}
                onTouchMove={touchMove}
                onTouchEnd={touchEnd}>

                <div className="mgallery-container" style={{
                        width: `${imgs.length * 100}%`,
                        WebkitTransform: `translateX(${x0 - currentIndex * _viewSize.w}px)`
                    }}>

                    { imgs.map((img, i) => {
                        let item = imgData[i];
                        let scalerStyle = (i == currentIndex) && item ? {
                            WebkitTransform: `translate3d(${scalerX}px,${scalerY}px,0) scale(${scale})`
                        } : {};
                        let itemClass = 'mgallery-item ';
                        if(item && item.long) itemClass += 'long';

                        return (
                            <div key={i} className={itemClass}>
                                <div className="mgallery-scaler" style={scalerStyle}>
                                    { lazyImgs[i] ?
                                        <img src={img} onLoad={(e) => imgLoaded(e, i)}/>
                                    : null }
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mgallery-dots">
                    { imgs.length > 1 ? imgs.map(function(img, i) {
                        return <i key={i} className={i == currentIndex ? 'on' : ''}/>;
                    }) : null }
                </div>
            </div>
        );
    },

    componentWillMount() {
        this.preLoadImg();

        this.props.onLoading();
    }
});
