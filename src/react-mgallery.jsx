import React from 'react';
import './style.less';

// 全屏视窗
let _viewSize = { w: window.innerWidth, h: window.innerHeight },
    _viewBasePoint = { x: _viewSize.w/2, y: _viewSize.h/2 };

let _items = {},
    _scrollingY,
    _scrollingX,
    _initialDistance,
    _initialScale,
    _initialScalerX,
    _initialScalerY,
    _initialCenterPoint,
    _lastCenterPoint;


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
function _calculateBounds(destScale, item) {
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
            gap: 20,// 切换过程中相邻图片的间隙
            actionDistance: 60,// 触发切换图片需要拖拽的距离

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

        _scrollingY = _scrollingX = 0;
        _initialScale = scale;
        _initialScalerX = scalerX;
        _initialScalerY = scalerY;
    },
    touchStart(e) {
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
            const { scale, currentIndex } = this.state;
            const { gap } = this.props;
            let scalerX = p1.x - _initialCenterPoint.x + _initialScalerX;
            let scalerY = p1.y - _initialCenterPoint.y + _initialScalerY;
            let { minX, minY, maxX, maxY } = _calculateBounds(scale, _items[currentIndex]);
            let x0 = 0;

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

            // 应用边界
            scalerY = _limit(minY, scalerY, maxY);
            let nextState = {x0, scalerX, scalerY};

            // 未缩放
            if(scale == 1) {
                let deltaX = Math.abs(scalerX - _initialScalerX);
                let deltaY = Math.abs(scalerY - _initialScalerY);
                let directionDistance = 6;

                if(_scrollingX || !_scrollingY && (_scrollingX = deltaX > directionDistance)) {
                    // 发生水平滚动时，限制垂直移动
                    delete nextState.scalerY;
                }

                if(_scrollingY || !_scrollingX && (_scrollingY = deltaY > directionDistance)) {
                    // 发生垂直滚动时，限制水平移动
                    delete nextState.x0;
                    delete nextState.scalerX;
                }
            }

            this.setState(nextState);
        }
    },
    touchEnd(e) {
        const { scale, currentIndex, x0} = this.state;
        const { maxScale, minScale, actionDistance } = this.props;
        let { touches } = e;

        if(touches.length) {
            // 为剩下的触点重新初始化
            this.init(touches);
        } else {
            // 触摸结束
            let nextState = { transition: 1, currentIndex };
            let destScale = _limit(minScale, scale, maxScale);
            let bounds = _calculateBounds(destScale, _items[currentIndex]);

            if(x0 < -actionDistance) {
                nextState.currentIndex++;
            }
            else if(x0 > actionDistance) {
                nextState.currentIndex--;
            }

            this.applyScale(destScale, bounds);
            this.setState(nextState);
        }
    },

    applyScale(destScale, bounds) {
        let item = _items[this.state.currentIndex];
        let baseY = item.long ? item.h / 2 : _viewBasePoint.y;
        let baseX = _viewBasePoint.x;

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
            x0: 0
        });
    },

    preLoadImg() {
        const { currentIndex, lazyImgs } = this.state;
        let _lazyImgs = {};
        let nextIndex = Math.min(this.props.imgs.length - 1, currentIndex + 1);
        let prevIndex = Math.max(0, currentIndex - 1);

        _lazyImgs[currentIndex] = 1;
        _lazyImgs[prevIndex] = 1;
        _lazyImgs[nextIndex] = 1;

        this.setState({ lazyImgs: Object.assign({}, lazyImgs, _lazyImgs)});
    },
    imgLoaded(e, i) {
        if(_items[i]) return;
        if(i == this.state.currentIndex) this.props.onLoaded();

        // 记录图片初始尺寸
        let img = e.target;
        let { width, height, naturalWidth, naturalHeight } = img;
        let fitH = _viewSize.w / naturalWidth * naturalHeight;// 适应屏幕宽度后的高度
        let long = fitH > _viewSize.h;

        if(long) {
            height = _viewSize.w * height / width;
            width = _viewSize.w;
        }

        _items[i] = {
            w: width,
            h: height,
            long,
            fixX: long ? (height - _viewSize.h) / 2 : 0,// 长图修复置顶
        }
    },
    render(){
        var { imgs } = this.props;
        var { currentIndex, lazyImgs, x0, scale, scalerX, scalerY, transition } = this.state;
        var { touchStart, touchMove, touchEnd, imgLoaded } = this;

        return (
            <div className={'mgallery' + (transition ? ' transition' : '')} ref="holder"
                onTouchStart={touchStart}
                onTouchMove={touchMove}
                onTouchEnd={touchEnd}>

                <div className="mgallery-container" style={{
                        width: `${imgs.length * 100}%`,
                        WebkitTransform: `translate3d(${x0 - currentIndex * _viewSize.w}px,0,0)`
                    }}>

                    { imgs.map((img, i) => {
                        let item = _items[i];
                        let scalerStyle = (i == currentIndex) && item ? {
                            WebkitTransform: `translate3d(${scalerX}px,${scalerY}px,0) scale(${scale})`
                        } : null;
                        let itemClass = 'mgallery-item';

                        if(i == currentIndex) {
                            itemClass += ' current ';
                            itemClass += item && item.long ? 'long' : 'normal';
                        }

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
